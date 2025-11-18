import json
from pathlib import Path

import pytest

from app.clearcast_updater import ClearcastUpdater


def _write_snapshot(path: Path, last_checked: str = "2025-11-10T10:00:00Z"):
    path.write_text(
        json.dumps(
            {
                "last_check": last_checked,
                "updates": [],
                "current_version": "v1.0.0",
                "auto_check_enabled": True,
                "snapshot": {
                    "version_id": "clearcast-v2025.11.10",
                    "last_checked": last_checked,
                    "source_document": "A Complete Guide to Passing TV Adverts_ Key Clearcast Guidance.pdf",
                    "rules": [
                        {
                            "code": "BCAP 3.1",
                            "title": "Misleading advertising",
                            "category": "Misleading Claims",
                            "summary": "Claims must be substantiated",
                            "severity": "high",
                            "prohibited_or_conditional": "conditional",
                            "age_restrictions": None,
                            "alcohol_or_gambling": False,
                            "claims_require_substantiation": True,
                            "scheduling_notes": None,
                            "example_phrases": ["Show evidence on screen"],
                            "tags": ["claims"],
                            "last_updated": "2024-10-01T00:00:00Z"
                        }
                    ]
                }
            }
        ),
        encoding="utf-8",
    )


@pytest.fixture(autouse=True)
def stub_create_gemini_model(monkeypatch):
    monkeypatch.setattr("app.gemini_utils.create_gemini_model", lambda *_, **__: None)


class _FakeResponse:
    def __init__(self, payload: dict):
        self.text = json.dumps(payload)


class _FakeModel:
    def __init__(self, payload: dict):
        self._response = _FakeResponse(payload)

    def generate_content(self, prompt: str):
        return self._response


def test_last_updated_text_reflects_snapshot_timestamp(tmp_path: Path):
    updates_file = tmp_path / "clearcast_updates.json"
    _write_snapshot(updates_file, last_checked="2025-11-10T10:00:00Z")

    updater = ClearcastUpdater(
        api_key="demo",
        updates_path=updates_file,
    )
    text = updater.get_last_updated_text()
    assert "Nov 10" in text or "10 Nov" in text


def test_check_for_updates_updates_snapshot_and_version(tmp_path: Path, monkeypatch):
    updates_file = tmp_path / "clearcast_updates.json"
    _write_snapshot(updates_file, last_checked="2025-11-10T10:00:00Z")

    fake_payload = {
        "has_updates": True,
        "changes": [{"type": "major", "category": "content", "description": "Test", "effective_date": "2025-11-12"}],
        "summary": "Test update",
    }
    monkeypatch.setattr(
        "app.clearcast_updater.ClearcastUpdater.model",
        _FakeModel(fake_payload),
        raising=False,
    )

    updater = ClearcastUpdater(
        api_key="demo",
        updates_path=updates_file,
    )
    updater.model = _FakeModel(fake_payload)

    results = updater.check_for_updates()

    snapshot = updater.update_history.get("snapshot", {})
    assert snapshot.get("last_checked") == results["checked_at"]
    assert snapshot.get("version_id") == "v1.0.1"
    assert updater.get_last_updated_text().endswith("UTC")

