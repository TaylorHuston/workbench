from __future__ import annotations

from collections.abc import Callable
from contextlib import AbstractContextManager
from dataclasses import dataclass
from typing import Protocol

from openai_codex import Codex, CodexError


class CodexAccount(Protocol):
    def account(self, *, refresh_token: bool = False) -> object: ...


CodexFactory = Callable[[], AbstractContextManager[CodexAccount]]


class CodexAuthenticationError(RuntimeError):
    pass


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
