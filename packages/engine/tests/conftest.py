import pytest
from story_data import REFERENCE, WEDNESDAY, conditions_for

from relay_engine.clock import Conditions
from relay_engine.network import Network
from relay_engine.reference import load_network


@pytest.fixture(scope="session")
def network() -> Network:
    return load_network(REFERENCE)


@pytest.fixture(scope="session")
def wednesday() -> Conditions:
    return conditions_for(WEDNESDAY)
