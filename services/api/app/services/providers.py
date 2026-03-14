from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator, Awaitable, Callable, Sequence
from dataclasses import dataclass, field
from typing import Any, Protocol

import httpx
from openai import AsyncOpenAI

from knowledge_engine.models import RetrievedChunk
from knowledge_engine.prompting import build_rag_messages


@dataclass(slots=True)
class ToolDefinition:
    name: str
    description: str
    parameters: dict[str, Any]


@dataclass(slots=True)
class ProviderRequest:
    question: str
    system_prompt: str
    conversation_history: Sequence[dict[str, str]]
    retrieved_chunks: Sequence[RetrievedChunk]
    citations: list[dict[str, str]]
    tools: list[ToolDefinition] = field(default_factory=list)
    max_output_tokens: int = 900
    temperature: float = 0.2


@dataclass(slots=True)
class GeneratedAnswer:
    text: str
    provider_name: str
    model_name: str
    citations: list[dict[str, str]]
    tool_calls: list[dict[str, Any]] = field(default_factory=list)


@dataclass(slots=True)
class StreamEvent:
    event: str
    data: dict[str, Any]


ToolExecutor = Callable[[str, dict[str, Any]], Awaitable[dict[str, Any]]]


class LLMProvider(Protocol):
    async def generate(self, request: ProviderRequest, tool_executor: ToolExecutor | None = None) -> GeneratedAnswer: ...

    async def stream(self, request: ProviderRequest) -> AsyncIterator[StreamEvent]: ...


class DeterministicRagProvider:
    name = "deterministic-rag"
    model = "extractive-synthesizer"

    async def generate(self, request: ProviderRequest, tool_executor: ToolExecutor | None = None) -> GeneratedAnswer:
        text = _render_extractive_answer(request)
        return GeneratedAnswer(
            text=text,
            provider_name=self.name,
            model_name=self.model,
            citations=request.citations,
        )

    async def stream(self, request: ProviderRequest) -> AsyncIterator[StreamEvent]:
        text = _render_extractive_answer(request)
        for token in text.split():
            yield StreamEvent(event="delta", data={"text": token + " "})
            await asyncio.sleep(0)


class OpenAIResponsesProvider:
    name = "openai-responses"

    def __init__(self, *, api_key: str, model: str, base_url: str | None = None) -> None:
        self._client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self._model = model

    async def generate(self, request: ProviderRequest, tool_executor: ToolExecutor | None = None) -> GeneratedAnswer:
        messages = build_rag_messages(
            user_question=request.question,
            chunks=request.retrieved_chunks,
            system_prompt=request.system_prompt,
            conversation_history=request.conversation_history,
        )
        response = await self._client.responses.create(
            model=self._model,
            input=messages,
            tools=_tool_payloads(request.tools) if request.tools else None,
            temperature=request.temperature,
            max_output_tokens=request.max_output_tokens,
        )
        tool_calls: list[dict[str, Any]] = []
        if tool_executor:
            response, tool_calls = await self._resolve_tool_calls(response, request, tool_executor)
        text = getattr(response, "output_text", "") or _coerce_output_text(response)
        return GeneratedAnswer(
            text=text.strip() or _render_extractive_answer(request),
            provider_name=self.name,
            model_name=self._model,
            citations=request.citations,
            tool_calls=tool_calls,
        )

    async def stream(self, request: ProviderRequest) -> AsyncIterator[StreamEvent]:
        messages = build_rag_messages(
            user_question=request.question,
            chunks=request.retrieved_chunks,
            system_prompt=request.system_prompt,
            conversation_history=request.conversation_history,
        )
        stream = await self._client.responses.create(
            model=self._model,
            input=messages,
            temperature=request.temperature,
            max_output_tokens=request.max_output_tokens,
            stream=True,
        )
        async for event in stream:
            event_type = getattr(event, "type", "")
            if event_type == "response.output_text.delta":
                yield StreamEvent(event="delta", data={"text": getattr(event, "delta", "")})

    async def _resolve_tool_calls(
        self,
        response: Any,
        request: ProviderRequest,
        tool_executor: ToolExecutor,
    ) -> tuple[Any, list[dict[str, Any]]]:
        tool_calls: list[dict[str, Any]] = []
        for _ in range(4):
            outputs = []
            for item in getattr(response, "output", []) or []:
                if getattr(item, "type", "") != "function_call":
                    continue
                arguments = json.loads(getattr(item, "arguments", "{}") or "{}")
                result = await tool_executor(getattr(item, "name"), arguments)
                outputs.append(
                    {
                        "type": "function_call_output",
                        "call_id": getattr(item, "call_id"),
                        "output": json.dumps(result),
                    }
                )
                tool_calls.append({"name": getattr(item, "name"), "arguments": arguments, "result": result})
            if not outputs:
                return response, tool_calls
            response = await self._client.responses.create(
                model=self._model,
                previous_response_id=getattr(response, "id"),
                input=outputs,
                tools=_tool_payloads(request.tools) if request.tools else None,
                temperature=request.temperature,
                max_output_tokens=request.max_output_tokens,
            )
        return response, tool_calls


class OllamaProvider:
    name = "ollama-chat"

    def __init__(self, *, base_url: str, model: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model

    async def generate(self, request: ProviderRequest, tool_executor: ToolExecutor | None = None) -> GeneratedAnswer:
        messages = build_rag_messages(
            user_question=request.question,
            chunks=request.retrieved_chunks,
            system_prompt=request.system_prompt,
            conversation_history=request.conversation_history,
        )
        async with httpx.AsyncClient(timeout=240.0) as client:
            response = await client.post(
                f"{self._base_url}/api/chat",
                json={
                    "model": self._model,
                    "messages": _ollama_messages(messages),
                    "stream": False,
                    "options": {
                        "temperature": request.temperature,
                        "num_predict": request.max_output_tokens,
                    },
                },
            )
            response.raise_for_status()
            payload = response.json()
        text = ((payload.get("message") or {}).get("content") or "").strip()
        return GeneratedAnswer(
            text=text or _render_extractive_answer(request),
            provider_name=self.name,
            model_name=self._model,
            citations=request.citations,
        )

    async def stream(self, request: ProviderRequest) -> AsyncIterator[StreamEvent]:
        messages = build_rag_messages(
            user_question=request.question,
            chunks=request.retrieved_chunks,
            system_prompt=request.system_prompt,
            conversation_history=request.conversation_history,
        )
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST",
                f"{self._base_url}/api/chat",
                json={
                    "model": self._model,
                    "messages": _ollama_messages(messages),
                    "stream": True,
                    "options": {
                        "temperature": request.temperature,
                        "num_predict": request.max_output_tokens,
                    },
                },
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    payload = json.loads(line)
                    text = ((payload.get("message") or {}).get("content") or "")
                    if text:
                        yield StreamEvent(event="delta", data={"text": text})
                    if payload.get("done"):
                        break


def build_provider(
    *,
    generation_provider: str,
    ollama_base_url: str,
    ollama_model: str,
    api_key: str | None,
    model: str,
    base_url: str | None,
) -> LLMProvider:
    if generation_provider == "ollama":
        return OllamaProvider(base_url=ollama_base_url, model=ollama_model)
    if api_key:
        return OpenAIResponsesProvider(api_key=api_key, model=model, base_url=base_url)
    return DeterministicRagProvider()


def _tool_payloads(tools: Sequence[ToolDefinition]) -> list[dict[str, Any]]:
    return [
        {
            "type": "function",
            "name": tool.name,
            "description": tool.description,
            "parameters": tool.parameters,
        }
        for tool in tools
    ]


def _coerce_output_text(response: Any) -> str:
    parts: list[str] = []
    for item in getattr(response, "output", []) or []:
        for content_item in getattr(item, "content", []) or []:
            if getattr(content_item, "type", "") == "output_text":
                parts.append(getattr(content_item, "text", ""))
    return "".join(parts)


def _ollama_messages(messages: Sequence[dict[str, object]]) -> list[dict[str, str]]:
    return [{"role": str(message["role"]), "content": str(message["content"])} for message in messages]


def _render_extractive_answer(request: ProviderRequest) -> str:
    if not request.retrieved_chunks:
        return "I do not have enough verified offline evidence to answer this question."

    lines = ["Based on the indexed offline sources:"]
    for citation, chunk in zip(request.citations[:4], request.retrieved_chunks[:4], strict=False):
        sentence = chunk.content.split(". ")[0].strip()
        if len(sentence) > 240:
            sentence = sentence[:237].rstrip() + "..."
        lines.append(f"- {sentence} [{citation['label']}]")
    lines.append("")
    lines.append("If you need a deeper answer, ask a narrower follow-up question.")
    return "\n".join(lines)
