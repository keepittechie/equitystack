#!/usr/bin/env python3
import json
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import requests


DEFAULT_CONFIG_PATH = Path(__file__).resolve().parents[2] / "config" / "llm.json"
DEFAULT_TIMEOUT_SECONDS = 240
DEFAULT_RESPONSE_LOG_LIMIT = 4000
DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1"
DEFAULT_OPENAI_MODEL = "gpt-4.1-mini"
LEGACY_LOCAL_MODEL_NAMES = {"qwen3.5:9b", "rnj-1:latest"}


class LLMProvider:
    def generate(self, prompt: str, system: str = None) -> str:
        raise NotImplementedError


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for line in path.read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def utc_timestamp() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def load_llm_config(config_path: Path | None = None) -> dict[str, Any]:
    path = config_path or Path(os.environ.get("EQUITYSTACK_LLM_CONFIG", DEFAULT_CONFIG_PATH))
    payload: dict[str, Any] = {}
    if path.exists():
        raw = json.loads(path.read_text())
        if isinstance(raw, dict):
            payload.update(raw)

    env_file_values = load_env_file(repo_root() / ".env.local")

    def env_value(key: str) -> str | None:
        return os.environ.get(key) or env_file_values.get(key)

    if env_value("EQUITYSTACK_LLM_PROVIDER"):
        payload["provider"] = env_value("EQUITYSTACK_LLM_PROVIDER")
    if env_value("EQUITYSTACK_LLM_MODEL"):
        payload["model"] = env_value("EQUITYSTACK_LLM_MODEL")
    elif env_value("EQUITYSTACK_OPENAI_MODEL"):
        payload["model"] = env_value("EQUITYSTACK_OPENAI_MODEL")
    elif env_value("OPENAI_MODEL"):
        payload["model"] = env_value("OPENAI_MODEL")
    if env_value("EQUITYSTACK_LLM_ENDPOINT"):
        payload["endpoint"] = env_value("EQUITYSTACK_LLM_ENDPOINT")
    if env_value("EQUITYSTACK_LLM_MODELS_ENDPOINT"):
        payload["models_endpoint"] = env_value("EQUITYSTACK_LLM_MODELS_ENDPOINT")
    if env_value("OPENAI_API_KEY"):
        payload["openai_api_key"] = env_value("OPENAI_API_KEY")
    if env_value("OPENAI_BASE_URL"):
        payload["openai_base_url"] = env_value("OPENAI_BASE_URL")
    if env_value("EQUITYSTACK_LLM_TIMEOUT"):
        payload["timeout_seconds"] = int(env_value("EQUITYSTACK_LLM_TIMEOUT"))
    if env_value("EQUITYSTACK_LLM_LOG_DIR"):
        payload["log_dir"] = env_value("EQUITYSTACK_LLM_LOG_DIR")
    return payload


def normalize_model_name(value: Any) -> str:
    return str(value or "").strip()


def looks_like_openai_model(value: Any) -> bool:
    normalized = normalize_model_name(value).lower()
    return normalized.startswith("gpt-") or normalized.startswith("chatgpt") or normalized.startswith("o")


def resolve_openai_compatible_model(requested_model: Any, config: dict[str, Any]) -> str:
    requested = normalize_model_name(requested_model)
    configured = normalize_model_name(config.get("model"))
    env_model = (
        normalize_model_name(os.environ.get("EQUITYSTACK_LLM_MODEL"))
        or normalize_model_name(os.environ.get("EQUITYSTACK_OPENAI_MODEL"))
        or normalize_model_name(os.environ.get("OPENAI_MODEL"))
    )
    if requested and requested not in LEGACY_LOCAL_MODEL_NAMES:
        return requested
    return env_model or configured or DEFAULT_OPENAI_MODEL


def default_model_name(config_path: Path | None = None) -> str:
    config = load_llm_config(config_path)
    return normalize_model_name(config.get("model")) or DEFAULT_OPENAI_MODEL


def resolve_log_dir(config: dict[str, Any]) -> Path:
    raw = config.get("log_dir") or "python/logs/llm"
    path = Path(raw)
    if not path.is_absolute():
        path = repo_root() / path
    path.mkdir(parents=True, exist_ok=True)
    return path


def truncate_text(value: Any, limit: int = DEFAULT_RESPONSE_LOG_LIMIT) -> str:
    text = str(value or "")
    if len(text) <= limit:
        return text
    return f"{text[:limit]}...<truncated {len(text) - limit} chars>"


def log_llm_event(config: dict[str, Any], payload: dict[str, Any]) -> None:
    if str(config.get("logging", "true")).lower() in {"0", "false", "no"}:
        return
    log_path = resolve_log_dir(config) / f"llm-provider-{datetime.now(UTC).date().isoformat()}.jsonl"
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps({"timestamp": utc_timestamp(), **payload}, ensure_ascii=True, default=str) + "\n")


def extract_response_text(payload: Any) -> str:
    if isinstance(payload, str):
        if not payload.strip():
            raise ValueError("LLM backend response text was empty")
        return payload
    if not isinstance(payload, dict):
        raise ValueError("LLM backend returned a non-object response")
    for key in ("response", "text", "output_text", "content"):
        value = payload.get(key)
        if isinstance(value, str):
            if not value.strip():
                raise ValueError(f"LLM backend response field '{key}' was empty")
            return value
    choices = payload.get("choices")
    if isinstance(choices, list) and choices:
        first = choices[0]
        if isinstance(first, dict):
            message = first.get("message")
            if isinstance(message, dict) and isinstance(message.get("content"), str):
                if not message["content"].strip():
                    raise ValueError("LLM backend chat response content was empty")
                return message["content"]
            if isinstance(first.get("text"), str):
                if not first["text"].strip():
                    raise ValueError("LLM backend choice text was empty")
                return first["text"]
    output = payload.get("output")
    if isinstance(output, list):
        chunks: list[str] = []
        for item in output:
            if not isinstance(item, dict):
                continue
            for content in item.get("content") or []:
                if isinstance(content, dict) and isinstance(content.get("text"), str):
                    chunks.append(content["text"])
        if chunks:
            text = "".join(chunks)
            if not text.strip():
                raise ValueError("LLM backend output content was empty")
            return text
    raise ValueError("LLM backend response did not include a supported text field")


def http_error_with_body(response: requests.Response) -> None:
    try:
        response.raise_for_status()
    except requests.HTTPError as error:
        body = response.text.strip()
        if len(body) > 500:
            body = f"{body[:500]}..."
        raise requests.HTTPError(
            f"{error}. Response body: {body}",
            response=response,
            request=response.request,
        ) from error


class DefaultLLMProvider(LLMProvider):
    def __init__(
        self,
        *,
        model: str | None = None,
        endpoint: str | None = None,
        openai_base_url: str | None = None,
        timeout_seconds: int | None = None,
        temperature: float | None = None,
        response_format: str | None = None,
        config: dict[str, Any] | None = None,
    ):
        self.config = {**(config or {})}
        self.openai_api_key = self.config.get("openai_api_key")
        explicit_openai_base_url = str(openai_base_url or "").strip()
        self.openai_base_url = (
            explicit_openai_base_url.rstrip("/")
            if explicit_openai_base_url
            else str(self.config.get("openai_base_url") or DEFAULT_OPENAI_BASE_URL).rstrip("/")
        )
        self.openai_base_url_was_explicit = bool(explicit_openai_base_url)
        self.requested_model = normalize_model_name(model or self.config.get("model"))
        self.model = (
            resolve_openai_compatible_model(model or self.config.get("model"), self.config)
            if self.openai_api_key
            else self.requested_model or None
        )
        self.endpoint_was_explicit = bool(normalize_model_name(endpoint))
        self.endpoint = endpoint or self.config.get("endpoint")
        self.timeout_seconds = int(timeout_seconds or self.config.get("timeout_seconds") or DEFAULT_TIMEOUT_SECONDS)
        self.temperature = temperature
        self.response_format = response_format or self.config.get("response_format")

    def should_use_openai_chat(self) -> bool:
        if not self.openai_api_key:
            return False
        if self.openai_base_url_was_explicit:
            return True
        if not self.endpoint:
            return True
        if not self.endpoint_was_explicit and looks_like_openai_model(self.model):
            return True
        return "api.openai.com" in self.endpoint or self.endpoint.rstrip("/").endswith("/chat/completions")

    def generate(self, prompt: str, system: str = None) -> str:
        if self.should_use_openai_chat():
            return self.generate_openai_chat(prompt, system)
        if not self.endpoint or "XXXX" in self.endpoint:
            raise ValueError(
                "LLM endpoint is not configured. Set config/llm.json endpoint or EQUITYSTACK_LLM_ENDPOINT."
            )
        request_payload: dict[str, Any] = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
        }
        if system:
            request_payload["system"] = system
        if self.response_format:
            request_payload["format"] = self.response_format
        if self.temperature is not None:
            request_payload["options"] = {"temperature": self.temperature}

        log_llm_event(
            self.config,
            {
                "event": "request",
                "provider": self.config.get("provider") or "default",
                "model": self.model,
                "requested_model": self.requested_model or self.model,
                "endpoint": self.endpoint,
                "prompt": truncate_text(prompt),
                "system": truncate_text(system),
            },
        )
        try:
            response = requests.post(self.endpoint, json=request_payload, timeout=self.timeout_seconds)
            http_error_with_body(response)
            text = extract_response_text(response.json())
            log_llm_event(
                self.config,
                {
                    "event": "response",
                    "provider": self.config.get("provider") or "default",
                    "model": self.model,
                    "requested_model": self.requested_model or self.model,
                    "endpoint": self.endpoint,
                    "response": truncate_text(text),
                },
            )
            return text
        except Exception as exc:
            log_llm_event(
                self.config,
                {
                    "event": "error",
                    "provider": self.config.get("provider") or "default",
                    "model": self.model,
                    "requested_model": self.requested_model or self.model,
                    "endpoint": self.endpoint,
                    "error": truncate_text(exc),
                },
            )
            raise

    def generate_openai_chat(self, prompt: str, system: str = None) -> str:
        endpoint = (
            self.endpoint
            if self.endpoint
            and ("api.openai.com" in self.endpoint or self.endpoint.rstrip("/").endswith("/chat/completions"))
            else f"{self.openai_base_url}/chat/completions"
        )
        if endpoint.rstrip("/").endswith("/v1"):
            endpoint = f"{endpoint.rstrip('/')}/chat/completions"
        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        request_payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
        }
        if self.response_format == "json":
            request_payload["response_format"] = {"type": "json_object"}
        if self.temperature is not None:
            request_payload["temperature"] = self.temperature

        log_llm_event(
            self.config,
            {
                "event": "request",
                "provider": "openai_chat",
                "model": self.model,
                "requested_model": self.requested_model or self.model,
                "endpoint": endpoint,
                "prompt": truncate_text(prompt),
                "system": truncate_text(system),
            },
        )
        try:
            response = requests.post(
                endpoint,
                json=request_payload,
                headers={
                    "authorization": f"Bearer {self.openai_api_key}",
                    "content-type": "application/json",
                },
                timeout=self.timeout_seconds,
            )
            http_error_with_body(response)
            text = extract_response_text(response.json())
            log_llm_event(
                self.config,
                {
                    "event": "response",
                    "provider": "openai_chat",
                    "model": self.model,
                    "requested_model": self.requested_model or self.model,
                    "endpoint": endpoint,
                    "response": truncate_text(text),
                },
            )
            return text
        except Exception as exc:
            log_llm_event(
                self.config,
                {
                    "event": "error",
                    "provider": "openai_chat",
                    "model": self.model,
                    "requested_model": self.requested_model or self.model,
                    "endpoint": endpoint,
                    "error": truncate_text(exc),
                },
            )
            raise


def get_default_provider(
    *,
    model: str | None = None,
    endpoint: str | None = None,
    openai_base_url: str | None = None,
    timeout_seconds: int | None = None,
    temperature: float | None = None,
    response_format: str | None = None,
) -> LLMProvider:
    config = load_llm_config()
    provider_name = str(config.get("provider") or "default").lower()
    if provider_name != "default":
        raise ValueError(f"Unsupported LLM provider: {provider_name}")
    return DefaultLLMProvider(
        model=model,
        endpoint=endpoint,
        openai_base_url=openai_base_url,
        timeout_seconds=timeout_seconds,
        temperature=temperature,
        response_format=response_format,
        config=config,
    )


def generate_text(
    prompt: str,
    *,
    system: str | None = None,
    model: str | None = None,
    endpoint: str | None = None,
    openai_base_url: str | None = None,
    timeout_seconds: int | None = None,
    temperature: float | None = None,
    response_format: str | None = "json",
) -> str:
    provider = get_default_provider(
        model=model,
        endpoint=endpoint,
        openai_base_url=openai_base_url,
        timeout_seconds=timeout_seconds,
        temperature=temperature,
        response_format=response_format,
    )
    return provider.generate(prompt, system)

def list_available_models(
    *,
    endpoint: str | None = None,
    openai_base_url: str | None = None,
    timeout_seconds: int | None = None,
) -> list[str]:
    config = load_llm_config()
    normalized_openai_base_url = str(openai_base_url or "").strip().rstrip("/")
    if normalized_openai_base_url:
        models_endpoint = (
            normalized_openai_base_url
            if normalized_openai_base_url.endswith("/models")
            else f"{normalized_openai_base_url}/models"
        )
    else:
        models_endpoint = endpoint or config.get("models_endpoint")
    headers = {}
    if (normalized_openai_base_url or not models_endpoint) and config.get("openai_api_key"):
        models_endpoint = f"{str(config.get('openai_base_url') or DEFAULT_OPENAI_BASE_URL).rstrip('/')}/models"
        headers["authorization"] = f"Bearer {config['openai_api_key']}"
        if normalized_openai_base_url:
            models_endpoint = (
                normalized_openai_base_url
                if normalized_openai_base_url.endswith("/models")
                else f"{normalized_openai_base_url}/models"
            )
    if not models_endpoint:
        return []
    response = requests.get(models_endpoint, headers=headers, timeout=int(timeout_seconds or config.get("timeout_seconds") or DEFAULT_TIMEOUT_SECONDS))
    http_error_with_body(response)
    payload = response.json()
    if isinstance(payload, dict):
        models = payload.get("models") or payload.get("data") or []
    elif isinstance(payload, list):
        models = payload
    else:
        return []
    names: list[str] = []
    for model in models:
        if isinstance(model, str):
            names.append(model)
        elif isinstance(model, dict):
            name = model.get("name") or model.get("id")
            if isinstance(name, str):
                names.append(name)
    return names
