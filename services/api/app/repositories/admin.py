from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import AppSetting, AuditEvent, IngestionJob, JobStatus, ToolExecution


class AdminRepository:
    async def create_job(
        self,
        db: AsyncSession,
        *,
        source_type: str,
        source_name: str,
        target_path: str | None,
        submitted_by_user_id: UUID | None,
        metadata: dict,
        workflow_id: str | None = None,
    ) -> IngestionJob:
        job = IngestionJob(
            source_type=source_type,
            source_name=source_name,
            target_path=target_path,
            submitted_by_user_id=submitted_by_user_id,
            metadata_json=metadata,
            workflow_id=workflow_id,
            progress={"processed": 0, "indexed": 0, "skipped": 0},
        )
        db.add(job)
        await db.flush()
        return job

    async def get_job(self, db: AsyncSession, job_id: UUID) -> IngestionJob | None:
        return await db.get(IngestionJob, job_id)

    async def update_job(
        self,
        db: AsyncSession,
        *,
        job: IngestionJob,
        status: str | None = None,
        progress: dict | None = None,
        error_message: str | None = None,
        workflow_id: str | None = None,
    ) -> IngestionJob:
        if status:
            job.status = status
            if status == JobStatus.RUNNING.value and job.started_at is None:
                job.started_at = datetime.now(UTC)
            if status in {JobStatus.SUCCEEDED.value, JobStatus.FAILED.value}:
                job.completed_at = datetime.now(UTC)
        if progress is not None:
            job.progress = progress
        if error_message is not None:
            job.error_message = error_message
        if workflow_id is not None:
            job.workflow_id = workflow_id
        await db.flush()
        return job

    async def list_jobs(self, db: AsyncSession, *, limit: int = 50) -> list[IngestionJob]:
        result = await db.execute(select(IngestionJob).order_by(IngestionJob.created_at.desc()).limit(limit))
        return list(result.scalars().all())

    async def record_tool_execution(
        self,
        db: AsyncSession,
        *,
        conversation_id: UUID | None,
        tool_name: str,
        status: str,
        tool_input: dict,
        tool_output: dict,
        error_message: str | None = None,
    ) -> ToolExecution:
        execution = ToolExecution(
            conversation_id=conversation_id,
            tool_name=tool_name,
            status=status,
            tool_input=tool_input,
            tool_output=tool_output,
            error_message=error_message,
            completed_at=datetime.now(UTC),
        )
        db.add(execution)
        await db.flush()
        return execution

    async def record_audit(
        self,
        db: AsyncSession,
        *,
        actor_user_id: UUID | None,
        event_type: str,
        target_type: str,
        target_id: str,
        payload: dict,
    ) -> AuditEvent:
        event = AuditEvent(
            actor_user_id=actor_user_id,
            event_type=event_type,
            target_type=target_type,
            target_id=target_id,
            payload=payload,
        )
        db.add(event)
        await db.flush()
        return event

    async def get_settings(self, db: AsyncSession) -> dict[str, dict]:
        result = await db.execute(select(AppSetting))
        return {setting.key: setting.value for setting in result.scalars().all()}

    async def upsert_settings(
        self,
        db: AsyncSession,
        *,
        values: dict[str, dict],
        updated_by_user_id: UUID | None,
    ) -> None:
        for key, value in values.items():
            setting = await db.get(AppSetting, key)
            if setting is None:
                db.add(AppSetting(key=key, value=value, updated_by_user_id=updated_by_user_id))
            else:
                setting.value = value
                setting.updated_by_user_id = updated_by_user_id
        await db.flush()
