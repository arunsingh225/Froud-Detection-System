import uuid


def generate_request_id() -> str:
    """Generate a unique UUID v4 string for distributed request tracking."""
    return str(uuid.uuid4())
