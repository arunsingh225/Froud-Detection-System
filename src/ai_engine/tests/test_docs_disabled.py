"""Swagger/ReDoc/OpenAPI are public by FastAPI design, so they must be off by default."""
import pytest


@pytest.mark.parametrize("path", ["/docs", "/redoc", "/openapi.json"])
def test_interactive_docs_are_disabled_by_default(unauthenticated_client, path):
    assert unauthenticated_client.get(path).status_code == 404
