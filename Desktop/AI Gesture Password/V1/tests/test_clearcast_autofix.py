from app.clearcast_autofix import (
    AUTO_FIX_ACTIONS,
    AUTO_FIX_CATEGORIES,
    AUTO_FIX_CATEGORY_ORDER,
    actions_by_category,
    can_auto_apply_action,
    validate_auto_fix_plan,
)


def test_auto_actions_allowed():
    assert can_auto_apply_action("normalize_audio")
    assert can_auto_apply_action("broadcast_safe")
    assert can_auto_apply_action("scale_hd")


def test_manual_actions_blocked():
    assert not can_auto_apply_action("rewrite_voiceover")
    assert not can_auto_apply_action("add_disclaimer_super")

    try:
        validate_auto_fix_plan({"rewrite_voiceover": True})
    except ValueError as exc:
        assert "voiceover" in str(exc)
    else:
        raise AssertionError("Expected ValueError for manual action")


def test_actions_grouped_by_category():
    grouped = actions_by_category()
    assert set(grouped.keys()) == set(AUTO_FIX_CATEGORIES.keys())
    assert grouped["technical_audio"]
    assert grouped["script_language"]


def test_category_order_covers_all_categories():
    assert set(AUTO_FIX_CATEGORY_ORDER) >= set(AUTO_FIX_CATEGORIES.keys())

