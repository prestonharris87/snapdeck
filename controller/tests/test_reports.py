"""
Tests for _render_markdown in snapdeck_controller.reports.

Run from repo root (venv-qualified):
    .venv/bin/python -m pytest controller/tests/test_reports.py -q
"""

from snapdeck_controller.reports import _render_markdown

# ---------------------------------------------------------------------------
# Minimal report builder helpers
# ---------------------------------------------------------------------------

_BASE_REPORT = {
    "report_id": "test-001",
    "created_at": "2026-06-20T00:00:00Z",
    "project": "test-project",
    "git": {"branch": "main", "sha": "abc1234"},
    "note": None,
    "screenshots": [],
}


def _make_report(*annotations):
    """Return a minimal report dict with one screenshot containing *annotations*."""
    report = dict(_BASE_REPORT)
    report["screenshots"] = [
        {
            "index": 1,
            "title": "Test Screenshot",
            "url": "http://localhost/",
            "viewport": {"w": 1280, "h": 800, "dpr": 1},
            "original": None,
            "annotated": None,
            "annotations": list(annotations),
            "console": [],
            "network_failures": [],
        }
    ]
    return report


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_render_markdown_box_renders_clean_line():
    """A box annotation renders as '- 🟥 (x,y) width×height' in the Annotations block."""
    report = _make_report({"id": "b1", "type": "box", "x": 300, "y": 80, "width": 160, "height": 90})
    md = _render_markdown(report)
    assert "- 🟥 (300,80) 160×90" in md
    # Must not contain the raw-dict repr substring
    assert "'type': 'box'" not in md


def test_render_markdown_box_not_raw_dict_fallthrough():
    """The box annotation must NOT fall through to the catch-all '- {a}' else branch."""
    report = _make_report({"id": "b1", "type": "box", "x": 10, "y": 20, "width": 50, "height": 30})
    md = _render_markdown(report)
    # The catch-all renders as '- {', which must not appear for a box annotation
    lines = md.splitlines()
    raw_fallthrough = [ln for ln in lines if ln.startswith("- {")]
    assert raw_fallthrough == [], f"Unexpected raw-dict fallthrough lines: {raw_fallthrough}"


def test_render_markdown_text_and_arrow_unchanged():
    """No-regression: existing text and arrow annotations render byte-identically."""
    text_ann = {"id": "t1", "type": "text", "x": 100, "y": 50, "text": "hello"}
    arrow_ann = {"id": "a1", "type": "arrow", "from": [10, 20], "to": [30, 40]}
    report = _make_report(text_ann, arrow_ann)
    md = _render_markdown(report)
    # Text: emoji + (x,y) + curly-quoted text (U+201C/U+201D as rendered by _render_markdown)
    assert "- 📝 (100,50) “hello”" in md
    # Arrow: emoji + from → to, no label
    assert "- ➡️ [10, 20] → [30, 40]" in md


def test_render_markdown_mixed_annotation_order_preserved():
    """text + arrow + box in one screenshot render in input order with correct prefixes."""
    text_ann = {"id": "t1", "type": "text", "x": 5, "y": 6, "text": "note"}
    arrow_ann = {"id": "a1", "type": "arrow", "from": [1, 2], "to": [3, 4]}
    box_ann = {"id": "b1", "type": "box", "x": 300, "y": 80, "width": 160, "height": 90}
    report = _make_report(text_ann, arrow_ann, box_ann)
    md = _render_markdown(report)

    pos_text = md.find("📝")
    pos_arrow = md.find("➡️")
    pos_box = md.find("🟥")

    assert pos_text != -1, "text annotation not found"
    assert pos_arrow != -1, "arrow annotation not found"
    assert pos_box != -1, "box annotation not found"
    assert pos_text < pos_arrow < pos_box, (
        f"Expected text({pos_text}) < arrow({pos_arrow}) < box({pos_box})"
    )


def test_render_markdown_box_missing_geometry_does_not_raise():
    """A box with missing width/height renders without raising (defensive .get() → None)."""
    report = _make_report({"id": "b1", "type": "box"})
    try:
        md = _render_markdown(report)
    except Exception as exc:  # noqa: BLE001
        raise AssertionError(f"_render_markdown raised unexpectedly: {exc}") from exc
    # The line is present with None placeholders — not a raw-dict fallthrough
    assert "🟥" in md
    assert "'type': 'box'" not in md
