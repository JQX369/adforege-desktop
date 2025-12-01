from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.video_storage import VideoAnalysisStorage


def _create_dummy_video(path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"\x00\x00\x00")
    return path


def test_polish_endpoint_accepts_modal_payload(monkeypatch, tmp_path):
    """Polish endpoint should accept modal payload and expose polished download."""
    from api import main

    storage_dir = tmp_path / "video_analyses"
    test_storage = VideoAnalysisStorage(storage_dir=str(storage_dir))
    source_video = _create_dummy_video(tmp_path / "source.mp4")
    analysis_id = test_storage.create_analysis(str(source_video))

    monkeypatch.setattr(main, "storage", test_storage, raising=False)

    class StubProcessor:
        def __init__(self):
            self.last_call = None

        def process_video(self, input_path, output_path, options=None, progress_callback=None):
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            Path(output_path).write_bytes(b"processed-video")
            self.last_call = {
                "input_path": input_path,
                "output_path": output_path,
                "options": options or {},
            }
            return {
                "success": True,
                "output_path": output_path,
                "fixes_applied": ["Normalized audio"],
                "warnings": [],
            }

    processor = StubProcessor()
    monkeypatch.setattr(main, "video_processor", processor, raising=False)

    client = TestClient(main.app)

    payload = {
        "analysis_id": analysis_id,
        "actions": {
            "normalize_audio": True,
            "auto_levels": True,
            "add_slate": True,
            "add_padding": True,
            "broadcast_safe": True,
        },
        "slate_info": {
            "clock_number": "ABC/PROD001/030",
            "client_name": "Client",
            "agency_name": "Agency",
            "product_name": "Product",
            "title": "Campaign",
        },
        "quality": "standard",
        "standard": "UK_CLEARCAST",
        "export_bright": False,
    }

    response = client.post("/clearcast/polish", json=payload)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "success"
    assert body["download_url"].endswith(f"/videos/polished/{analysis_id}")

    assert processor.last_call is not None
    options = processor.last_call["options"]
    assert options.get("slate_info", {}).get("clock_number") == "ABC/PROD001/030"
    assert options.get("quality") == "standard"
    assert options.get("standard") == "UK_CLEARCAST"

    stored = test_storage.get_analysis(analysis_id)
    processing = stored.get("video_processing")
    assert processing, "video processing metadata should be persisted"
    delivery = processing.get("delivery_metadata") or {}
    assert delivery.get("clock_number") == "ABC/PROD001/030"

    download = client.get(f"/videos/polished/{analysis_id}")
    assert download.status_code == 200
    assert download.content == b"processed-video"

