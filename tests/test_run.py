import json

from eval.run import render_compare


def _write(tmp_path, name, summary, results):
    path = tmp_path / name
    path.write_text(json.dumps({"summary": summary, "results": results}))
    return str(path)


def test_render_compare_merges_two_result_files_into_one_table(tmp_path):
    default_path = _write(
        tmp_path, "default.json",
        summary={"mean_fama": 1.0, "mean_token_savings_ratio": 2.0},
        results=[{
            "user_id": "trace_x", "fama": {"fama": 1.0}, "engine_tokens": 10,
            "baseline_tokens": 20, "token_savings_ratio": 2.0,
        }],
    )
    no_forgetting_path = _write(
        tmp_path, "no-forgetting.json",
        summary={"mean_fama": 0.5, "mean_token_savings_ratio": 1.0},
        results=[{
            "user_id": "trace_x", "fama": {"fama": 0.5}, "engine_tokens": 20,
            "baseline_tokens": 20, "token_savings_ratio": 1.0,
        }],
    )

    table = render_compare(default_path, no_forgetting_path)

    assert "trace_x" in table
    # per-trace FAMA columns and the delta between them
    assert "| trace_x | 1.0 | 0.5 | 0.5 |" in table
    # summary rows for both configs
    assert "default (engine) | 1.0 | 2.0x" in table
    assert "no-forgetting (ablation) | 0.5 | 1.0x" in table
    # headline gap callout
    assert "FAMA gap (default" in table


def test_render_compare_never_recomputes_scores_it_just_formats_the_files(tmp_path):
    # A trace with a FAMA of 1.0 in both files should show a zero delta —
    # proves the function reads the stored fama value, not something derived
    # from engine/baseline tokens (which differ here).
    default_path = _write(
        tmp_path, "default.json",
        summary={"mean_fama": 1.0, "mean_token_savings_ratio": 3.0},
        results=[{
            "user_id": "trace_y", "fama": {"fama": 1.0}, "engine_tokens": 5,
            "baseline_tokens": 15, "token_savings_ratio": 3.0,
        }],
    )
    no_forgetting_path = _write(
        tmp_path, "no-forgetting.json",
        summary={"mean_fama": 1.0, "mean_token_savings_ratio": 1.0},
        results=[{
            "user_id": "trace_y", "fama": {"fama": 1.0}, "engine_tokens": 15,
            "baseline_tokens": 15, "token_savings_ratio": 1.0,
        }],
    )

    table = render_compare(default_path, no_forgetting_path)

    assert "| trace_y | 1.0 | 1.0 | 0.0 |" in table


def test_render_compare_skips_traces_missing_from_the_no_forgetting_file(tmp_path):
    # Defensive case: if the two committed files ever diverge (shouldn't
    # happen for same-freeze traces, but the merge must not crash).
    default_path = _write(
        tmp_path, "default.json",
        summary={"mean_fama": 1.0, "mean_token_savings_ratio": 1.0},
        results=[
            {"user_id": "trace_a", "fama": {"fama": 1.0}, "engine_tokens": 1, "baseline_tokens": 1, "token_savings_ratio": 1.0},
            {"user_id": "trace_missing", "fama": {"fama": 1.0}, "engine_tokens": 1, "baseline_tokens": 1, "token_savings_ratio": 1.0},
        ],
    )
    no_forgetting_path = _write(
        tmp_path, "no-forgetting.json",
        summary={"mean_fama": 1.0, "mean_token_savings_ratio": 1.0},
        results=[
            {"user_id": "trace_a", "fama": {"fama": 1.0}, "engine_tokens": 1, "baseline_tokens": 1, "token_savings_ratio": 1.0},
        ],
    )

    table = render_compare(default_path, no_forgetting_path)

    assert "trace_a" in table
    assert "trace_missing" not in table
