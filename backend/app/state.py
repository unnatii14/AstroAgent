"""Shared state schema for the AstroAgent graph.

This is the single source of truth for what flows between graph nodes.
`chart` caches the computed natal chart for the session: charts are
deterministic, so one computation per (birth details) is enough - cheaper,
faster, and the model can never "lose" the birth time between turns.
"""

from typing import Annotated, Optional, TypedDict

from langgraph.graph.message import add_messages


class BirthDetails(TypedDict, total=False):
    """Birth data collected from the user (all optional until provided)."""

    date: str            # "YYYY-MM-DD"
    time: Optional[str]  # "HH:MM" 24h, or None if unknown
    place: str           # free-text place name, e.g. "Jaipur, India"


class AgentState(TypedDict):
    """State carried through the graph on every turn.

    `messages` uses the `add_messages` reducer: when a node returns
    {"messages": [new_msg]}, LangGraph APPENDS it to history instead of
    replacing it. This is what makes the graph conversational.

    `chart` is {"details": <birth details it was computed for>, "data": <tool
    result>}. The details snapshot lets the tool node detect when the user
    edited their birth details and the cache must be invalidated.
    """

    messages: Annotated[list, add_messages]
    birth_details: Optional[BirthDetails]
    chart: Optional[dict]
