from __future__ import annotations

import sys

from pkm_api.infrastructure.codex_auth import (
    CodexAuthenticationError,
    verify_chatgpt_codex_authentication,
)


def main() -> int:
    try:
        authentication = verify_chatgpt_codex_authentication()
    except CodexAuthenticationError as error:
        print(f"Codex authentication: unavailable ({error})", file=sys.stderr)
        return 1

    plan = authentication.plan or "unknown"
    print(f"Codex authentication: ready (method={authentication.method}, plan={plan})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
