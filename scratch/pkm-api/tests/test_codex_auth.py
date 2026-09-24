from __future__ import annotations

from contextlib import AbstractContextManager
from types import SimpleNamespace
from typing import Self

import pytest

from pkm_api.infrastructure.codex_auth import (
    CodexAuthenticationError,
    verify_chatgpt_codex_authentication,
)


class FakeCodex(AbstractContextManager["FakeCodex"]):
    def __init__(self, account: object | None) -> None:
        self._account = account
        self.refresh_token = False

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def account(self, *, refresh_token: bool = False) -> object:
        self.refresh_token = refresh_token
        wrapped = None if self._account is None else SimpleNamespace(root=self._account)
        return SimpleNamespace(account=wrapped, requires_openai_auth=True)


def test_chatgpt_authentication_is_refreshed_and_reported() -> None:
    account = SimpleNamespace(
        type="chatgpt",
        plan_type=SimpleNamespace(value="pro"),
    )
    codex = FakeCodex(account)

    authentication = verify_chatgpt_codex_authentication(codex_factory=lambda: codex)

    assert codex.refresh_token is True
    assert authentication.method == "chatgpt"
    assert authentication.plan == "pro"


def test_missing_codex_authentication_is_rejected() -> None:
    with pytest.raises(CodexAuthenticationError, match="codex login"):
        verify_chatgpt_codex_authentication(codex_factory=lambda: FakeCodex(None))


def test_api_key_login_is_not_mistaken_for_subscription_login() -> None:
    account = SimpleNamespace(type="apiKey")

    with pytest.raises(CodexAuthenticationError, match="ChatGPT subscription"):
        verify_chatgpt_codex_authentication(codex_factory=lambda: FakeCodex(account))
