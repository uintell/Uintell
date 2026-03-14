from __future__ import annotations

from uuid import UUID

from temporalio import activity

from app.services.ingestion import IngestionService


class IngestionActivities:
    def __init__(self, ingestion: IngestionService) -> None:
        self._ingestion = ingestion

    @activity.defn(name="run_ingestion_job")
    async def run_ingestion_job(self, job_id: str) -> dict:
        summary = await self._ingestion.process_job(UUID(job_id))
        return summary.to_progress()
