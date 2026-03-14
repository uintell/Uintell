from worker_app.workflows.ingestion import ArchWikiIngestionWorkflow, FileIngestionWorkflow


def test_workflow_names_are_declared() -> None:
    assert ArchWikiIngestionWorkflow.__name__ == "ArchWikiIngestionWorkflow"
    assert FileIngestionWorkflow.__name__ == "FileIngestionWorkflow"
