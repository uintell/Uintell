FROM rust:1.90-bookworm AS builder

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY apps/backend/Cargo.toml apps/backend/Cargo.toml
COPY apps/backend/src apps/backend/src
COPY apps/backend/tests apps/backend/tests
COPY apps/backend/migrations apps/backend/migrations

RUN cargo build --release --manifest-path apps/backend/Cargo.toml --bin api --bin ingest_wikipedia --bin ingest_archwiki --bin build_index --bin embed_worker --bin seed_demo --bin migrate

FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/release/api /app/api
COPY --from=builder /app/target/release/ingest_wikipedia /app/ingest_wikipedia
COPY --from=builder /app/target/release/ingest_archwiki /app/ingest_archwiki
COPY --from=builder /app/target/release/build_index /app/build_index
COPY --from=builder /app/target/release/embed_worker /app/embed_worker
COPY --from=builder /app/target/release/seed_demo /app/seed_demo
COPY --from=builder /app/target/release/migrate /app/migrate

CMD ["/app/api"]
