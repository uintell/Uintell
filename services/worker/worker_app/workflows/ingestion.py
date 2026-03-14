from __future__ import annotations

from datetime import timedelta

from temporalio import workflow


@workflow.defn(name="ArchWikiIngestionWorkflow")
class ArchWikiIngestionWorkflow:
    @workflow.run
    async def run(self, job_id: str) -> dict:
        return await workflow.execute_activity(
            "run_ingestion_job",
            job_id,
            schedule_to_close_timeout=timedelta(hours=6),
        )


@workflow.defn(name="WikipediaIngestionWorkflow")
class WikipediaIngestionWorkflow:
    @workflow.run
    async def run(self, job_id: str) -> dict:
        return await workflow.execute_activity(
            "run_ingestion_job",
            job_id,
            schedule_to_close_timeout=timedelta(hours=24),
        )


@workflow.defn(name="FilesystemIngestionWorkflow")
class FilesystemIngestionWorkflow:
    @workflow.run
    async def run(self, job_id: str) -> dict:
        return await workflow.execute_activity(
            "run_ingestion_job",
            job_id,
            schedule_to_close_timeout=timedelta(hours=2),
        )


@workflow.defn(name="FileIngestionWorkflow")
class FileIngestionWorkflow:
    @workflow.run
    async def run(self, job_id: str) -> dict:
        return await workflow.execute_activity(
            "run_ingestion_job",
            job_id,
            schedule_to_close_timeout=timedelta(hours=1),
        )
