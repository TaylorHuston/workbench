from __future__ import annotations

import threading
from collections.abc import Callable
from contextlib import suppress
from typing import Protocol, cast


class JobLeadProcessor(Protocol):
    def process_next(self, *, worker_id: str) -> object | None: ...


class BackgroundJobLeadWorker(Protocol):
    @property
    def status(self) -> str: ...

    def start(self) -> None: ...

    def wake(self) -> None: ...

    def stop(self) -> None: ...


class InProcessJobLeadWorker:
    """Single-consumer worker that drains durable work and sleeps when idle."""

    def __init__(
        self,
        processor: JobLeadProcessor,
        *,
        worker_id: str,
        idle_poll_seconds: float = 1.0,
        error_backoff_seconds: float = 1.0,
        shutdown_timeout_seconds: float = 20.0,
    ) -> None:
        if idle_poll_seconds <= 0:
            raise ValueError("idle_poll_seconds must be positive")
        if error_backoff_seconds <= 0:
            raise ValueError("error_backoff_seconds must be positive")
        if shutdown_timeout_seconds <= 0:
            raise ValueError("shutdown_timeout_seconds must be positive")
        self._processor = processor
        self._worker_id = worker_id
        self._idle_poll_seconds = idle_poll_seconds
        self._error_backoff_seconds = error_backoff_seconds
        self._shutdown_timeout_seconds = shutdown_timeout_seconds
        self._wake_event = threading.Event()
        self._stop_event = threading.Event()
        self._state_lock = threading.Lock()
        self._status = "notStarted"
        self._thread: threading.Thread | None = None

    @property
    def status(self) -> str:
        with self._state_lock:
            return self._status

    def start(self) -> None:
        with self._state_lock:
            if self._thread is not None:
                raise RuntimeError("The in-process worker has already been started.")
            self._status = "running"
            self._thread = threading.Thread(
                target=self._run,
                name=f"pkm-api-worker:{self._worker_id}",
                daemon=True,
            )
            thread = self._thread
        thread.start()

    def wake(self) -> None:
        self._wake_event.set()

    def stop(self) -> None:
        self._set_status("stopping")
        self._stop_event.set()
        self._wake_event.set()
        cancel = cast(
            Callable[[], None] | None,
            getattr(self._processor, "cancel", None),
        )
        if cancel is not None:
            with suppress(Exception):
                cancel()
        with self._state_lock:
            thread = self._thread
        if thread is not None:
            thread.join(timeout=self._shutdown_timeout_seconds)
            if thread.is_alive():
                self._set_status("failed")
                return
        self._set_status("stopped")

    def _run(self) -> None:
        while not self._stop_event.is_set():
            self._wake_event.clear()
            try:
                while not self._stop_event.is_set():
                    result = self._processor.process_next(worker_id=self._worker_id)
                    if result is None:
                        break
            except Exception:
                self._set_status("degraded")
                if self._stop_event.wait(self._error_backoff_seconds):
                    break
                self._set_status("running")
                continue
            if not self._stop_event.is_set():
                self._wake_event.wait(self._idle_poll_seconds)
        if self.status != "failed":
            self._set_status("stopped")

    def _set_status(self, status: str) -> None:
        with self._state_lock:
            self._status = status
