from __future__ import annotations

import pytest

from pkm_api.__main__ import require_loopback_bind


@pytest.mark.parametrize("host", ["127.0.0.1", "::1", "localhost"])
def test_loopback_bind_is_allowed(host: str) -> None:
    assert require_loopback_bind(host) == host


@pytest.mark.parametrize("host", ["0.0.0.0", "192.168.1.20", "example.com"])
def test_non_loopback_bind_is_rejected_until_inbound_auth_exists(host: str) -> None:
    with pytest.raises(ValueError, match="inbound authentication is disabled"):
        require_loopback_bind(host)
