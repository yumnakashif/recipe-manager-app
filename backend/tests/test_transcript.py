from app.services.transcript import TranscriptAnalyzer


def test_transcript_analyzer_detects_signal() -> None:
    analyzer = TranscriptAnalyzer()
    transcript = "Add 2 cups flour, mix well, then bake for 20 minutes."
    info = analyzer.analyze(transcript, caption_type="manual")
    assert info.word_count > 0
    assert info.has_cooking_verbs is True
    assert info.has_numeric_quantities is True
    assert info.caption_type == "manual"
