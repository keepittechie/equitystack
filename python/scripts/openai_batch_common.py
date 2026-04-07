#!/usr/bin/env python3
import json
import os
from pathlib import Path
from typing import Any

import requests

from current_admin_common import load_env_file


DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1"


def get_project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def load_openai_env_values() -> dict[str, str]:
    values = load_env_file(get_project_root() / ".env.local")
    for key in (
        "OPENAI_API_KEY",
        "OPENAI_BASE_URL",
        "EQUITYSTACK_OPENAI_API_KEY",
        "EQUITYSTACK_OPENAI_BASE_URL",
    ):
        if os.environ.get(key):
            values[key] = os.environ[key]
    return values


def resolve_openai_api_key(env_values: dict[str, str]) -> str | None:
    return (
        env_values.get("OPENAI_API_KEY")
        or env_values.get("EQUITYSTACK_OPENAI_API_KEY")
        or None
    )


def resolve_openai_base_url(env_values: dict[str, str], explicit_base_url: str | None = None) -> str:
    return (
        (explicit_base_url or "").strip()
        or env_values.get("OPENAI_BASE_URL", "").strip()
        or env_values.get("EQUITYSTACK_OPENAI_BASE_URL", "").strip()
        or DEFAULT_OPENAI_BASE_URL
    ).rstrip("/")


class OpenAIBatchClient:
    def __init__(self, *, api_key: str, base_url: str) -> None:
        if not api_key.strip():
            raise ValueError("OPENAI_API_KEY is required for OpenAI Batch review.")
        self.api_key = api_key.strip()
        self.base_url = base_url.rstrip("/")

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
        }

    def _json_headers(self) -> dict[str, str]:
        return {
            **self._headers(),
            "Content-Type": "application/json",
        }

    def upload_batch_file(self, file_path: Path) -> dict[str, Any]:
        with file_path.open("rb") as handle:
            response = requests.post(
                f"{self.base_url}/files",
                headers=self._headers(),
                data={"purpose": "batch"},
                files={"file": (file_path.name, handle, "application/jsonl")},
                timeout=120,
            )
        response.raise_for_status()
        return response.json()

    def create_batch(
        self,
        *,
        input_file_id: str,
        endpoint: str,
        completion_window: str,
        metadata: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "input_file_id": input_file_id,
            "endpoint": endpoint,
            "completion_window": completion_window,
        }
        if metadata:
            payload["metadata"] = metadata
        response = requests.post(
            f"{self.base_url}/batches",
            headers=self._json_headers(),
            data=json.dumps(payload),
            timeout=120,
        )
        response.raise_for_status()
        return response.json()

    def retrieve_batch(self, batch_id: str) -> dict[str, Any]:
        response = requests.get(
            f"{self.base_url}/batches/{batch_id}",
            headers=self._json_headers(),
            timeout=120,
        )
        response.raise_for_status()
        return response.json()

    def download_file_content(self, file_id: str) -> str:
        response = requests.get(
            f"{self.base_url}/files/{file_id}/content",
            headers=self._headers(),
            timeout=120,
        )
        response.raise_for_status()
        return response.text
