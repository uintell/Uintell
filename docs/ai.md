# AI

## Default provider path

The local-first default is:

- Ollama for generation
- Ollama embeddings for vector search
- grounded retrieval over ingested document chunks

OpenAI remains optional rather than primary.

## Answering model

The assistant is expected to:

- retrieve relevant chunks first
- answer from retrieved evidence only
- cite supporting sources
- clearly say when evidence is weak or missing

## Current UI surface

The product already exposes:

- streaming chat
- hybrid search
- a reader with backlinks and related reading

The chat surface is still the main AI interaction point, while the search and reader surfaces now provide the context and navigation primitives needed for grounded answers.
