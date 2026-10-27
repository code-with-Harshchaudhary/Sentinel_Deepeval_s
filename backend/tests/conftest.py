import os
from pathlib import Path

TEST_DB = Path(__file__).parent / "test-api.db"
TEST_DB.unlink(missing_ok=True)
os.environ["AXIOM_DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ.pop("OPENAI_API_KEY", None)


def pytest_sessionfinish(session, exitstatus) -> None:
    del session, exitstatus
    from app.database import engine

    engine.dispose()
    TEST_DB.unlink(missing_ok=True)
