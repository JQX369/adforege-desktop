from app.features.clearcast.clearcast_audio import ClearcastAudioAnalyzer, AudioNormalizationReport


def test_evaluate_levels_ok():
    analyzer = ClearcastAudioAnalyzer(ffmpeg_path=None)
    report = analyzer._evaluate_levels(
        {"integrated_lufs": -23.2, "true_peak": -1.5, "lra": 9.0}
    )
    assert report.status == "ok"
    assert "within" in report.recommendation.lower()


def test_evaluate_levels_needs_normalization():
    analyzer = ClearcastAudioAnalyzer(ffmpeg_path=None)
    report = analyzer._evaluate_levels(
        {"integrated_lufs": -20.0, "true_peak": -0.5, "lra": 8.0}
    )
    assert report.status == "needs_normalization"
    assert "normalize" in report.recommendation.lower()


def test_evaluate_levels_no_audio():
    analyzer = ClearcastAudioAnalyzer(ffmpeg_path=None)
    report = analyzer._evaluate_levels({"integrated_lufs": None})
    assert report.status == "no_audio"

