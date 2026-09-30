from pathlib import Path

import pytest

from relay_engine.network import Network
from relay_engine.reference import load_network

REFERENCE = Path(__file__).resolve().parents[3] / "seed" / "data" / "reference"


@pytest.fixture(scope="session")
def network() -> Network:
    return load_network(REFERENCE)
