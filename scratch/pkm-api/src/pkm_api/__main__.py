from __future__ import annotations

import ipaddress
import os

import uvicorn


def require_loopback_bind(host: str) -> str:
    if host.lower() == "localhost":
        return host
    try:
        address = ipaddress.ip_address(host)
    except ValueError as error:
        raise ValueError(
            "PKM_API_HOST must be localhost or a loopback IP while inbound "
            "authentication is disabled."
        ) from error
    if not address.is_loopback:
        raise ValueError(
            "PKM_API_HOST must be localhost or a loopback IP while inbound "
            "authentication is disabled."
        )
    return host


def main() -> None:
    host = require_loopback_bind(os.environ.get("PKM_API_HOST", "127.0.0.1"))
    uvicorn.run(
        "pkm_api.main:app",
        host=host,
        port=int(os.environ.get("PKM_API_PORT", "8000")),
        reload=False,
        access_log=False,
    )


if __name__ == "__main__":
    main()
