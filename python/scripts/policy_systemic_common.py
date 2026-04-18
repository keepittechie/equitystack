from typing import Any

from current_admin_common import normalize_nullable_text


VALID_SYSTEMIC_IMPACT_CATEGORIES = {
    "limited",
    "standard",
    "strong",
    "transformational",
    "unclear",
}

SYSTEMIC_IMPACT_COLUMNS = {"systemic_impact_category", "systemic_impact_summary"}

SYSTEMIC_MULTIPLIERS = {
    "limited": 0.9,
    "standard": 1.0,
    "strong": 1.15,
    "transformational": 1.3,
    "unclear": 1.0,
    None: 1.0,
}

SYSTEMIC_CATEGORY_RANK = {
    "unclear": 0,
    "limited": 1,
    "standard": 2,
    "strong": 3,
    "transformational": 4,
}


def normalize_systemic_impact_category(value: Any) -> str | None:
    text = normalize_nullable_text(value)
    if text is None:
        return None
    normalized = text.lower().replace("-", "_")
    return normalized if normalized in VALID_SYSTEMIC_IMPACT_CATEGORIES else None


def resolve_systemic_impact_category(value: Any) -> str:
    return normalize_systemic_impact_category(value) or "standard"


def systemic_multiplier_for(value: Any) -> float:
    return SYSTEMIC_MULTIPLIERS.get(resolve_systemic_impact_category(value), 1.0)

