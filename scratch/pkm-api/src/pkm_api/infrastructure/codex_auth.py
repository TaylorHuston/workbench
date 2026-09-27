from __future__ import annotations

import os
from collections.abc import Callable
from contextlib import AbstractContextManager
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from openai_codex import Codex, CodexError


class CodexAccount(Protocol):
    def account(self, *, refresh_token: bool = False) -> object: ...


CodexFactory = Callable[[], AbstractContextManager[CodexAccount]]


class CodexAuthenticationError(RuntimeError):
    pass


def resolve_codex_auth_file() -> Path:
    codex_home = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex"))
    auth_file = codex_home / "auth.json"
    if auth_file.is_symlink() or not auth_file.is_file():
        raise CodexAuthenticationError(
            "Codex authentication is unavailable. Run `codex login` as the "
            "service user."
        )
    return auth_file.resolve(strict=True)


@dataclass(frozen=True, slots=True)
class CodexAuthentication:
    method: str
    plan: str | None


def verify_chatgpt_codex_authentication(
    *, codex_factory: CodexFactory = Codex
) -> CodexAuthentication:
    """Verify the local Codex cache contains a refreshable ChatGPT login."""
    try:
        with codex_factory() as codex:
            return verify_chatgpt_codex_account(codex)
    except (CodexError, OSError) as error:
        raise CodexAuthenticationError(
            "Codex could not read or refresh its local authentication state."
        ) from error


def verify_chatgpt_codex_account(codex: CodexAccount) -> CodexAuthentication:
    """Verify one already-isolated Codex client's refreshed account state."""
    try:
        response = codex.account(refresh_token=True)
    except (CodexError, OSError) as error:
        raise CodexAuthenticationError(
            "Codex could not read or refresh its local authentication state."
        ) from error

    account_wrapper = getattr(response, "account", None)
    account = getattr(account_wrapper, "root", None)
    if account is None:
        raise CodexAuthenticationError(
            "Codex is not logged in. Run `codex login` as the service user."
        )

    method = getattr(account, "type", None)
    if method != "chatgpt":
        raise CodexAuthenticationError(
            "Codex is not using the required ChatGPT subscription login."
        )

    plan_type = getattr(account, "plan_type", None)
    plan = getattr(plan_type, "value", None)
    return CodexAuthentication(method=method, plan=plan)
