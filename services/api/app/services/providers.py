from __future__ import annotations

import asyncio
import json
import re
from collections.abc import AsyncIterator, Awaitable, Callable, Sequence
from dataclasses import dataclass, field
from typing import Any, Protocol

import httpx
from openai import AsyncOpenAI

from knowledge_engine.models import RetrievedChunk
from knowledge_engine.prompting import build_rag_messages

QUESTION_TOKEN_RE = re.compile(r"[a-z0-9]{3,}")
QUESTION_STOPWORDS = {
    "about",
    "after",
    "also",
    "because",
    "could",
    "does",
    "from",
    "have",
    "into",
    "just",
    "more",
    "only",
    "page",
    "question",
    "source",
    "that",
    "their",
    "them",
    "there",
    "these",
    "this",
    "what",
    "when",
    "where",
    "which",
    "with",
    "would",
}


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

    question_terms = _question_terms(request.question)
    evidence = _rank_supporting_sentences(request, question_terms=question_terms)
    if not evidence:
        return "I found indexed evidence, but it does not clearly support a reliable answer to that question."

    lines = ["The strongest available evidence suggests:"]
    for sentence, label in evidence[:4]:
        lines.append(f"- {sentence} [{label}]")
    lines.append("")
    lines.append("This answer is limited to the indexed evidence retrieved for this page or source.")
    return "\n".join(lines)


def _question_terms(question: str) -> list[str]:
    return [
        token
        for token in QUESTION_TOKEN_RE.findall(question.lower())
        if token not in QUESTION_STOPWORDS
    ]


def _rank_supporting_sentences(
    request: ProviderRequest,
    *,
    question_terms: Sequence[str],
) -> list[tuple[str, str]]:
    ranked: list[tuple[int, int, str, str]] = []
    seen: set[str] = set()

    for chunk_index, (citation, chunk) in enumerate(zip(request.citations, request.retrieved_chunks, strict=False)):
        for sentence in _split_sentences(chunk.content):
            normalized = sentence.lower()
            if normalized in seen:
                continue
            seen.add(normalized)
            score = _sentence_score(sentence, question_terms=question_terms)
            if score <= 0 and question_terms:
                continue
            ranked.append((score, -chunk_index, sentence, citation["label"]))

    if not ranked:
        for chunk_index, (citation, chunk) in enumerate(zip(request.citations, request.retrieved_chunks, strict=False)):
            fallback = _clip_sentence(chunk.content)
            if fallback:
                ranked.append((1, -chunk_index, fallback, citation["label"]))

    ranked.sort(reverse=True)
    return [(sentence, label) for _, _, sentence, label in ranked[:4]]


def _split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [_clip_sentence(part) for part in parts if _clip_sentence(part)]


def _clip_sentence(text: str) -> str:
    sentence = " ".join(text.split()).strip()
    if len(sentence) > 280:
        sentence = sentence[:277].rstrip() + "..."
    return sentence


def _sentence_score(sentence: str, *, question_terms: Sequence[str]) -> int:
    if not sentence:
        return 0
    haystack = sentence.lower()
    if not question_terms:
        return 1
    matches = sum(1 for term in question_terms if term in haystack)
    return matches
