import json

from eval.run import render_compare


def _write(tmp_path, name, summary, results):
    path = tmp_path / name
    path.write_text(json.dumps({"summary": summary, "results": results}))
    return str(path)


def test_render_compare_merges_three_result_files_into_one_table(tmp_path):
    default_path = _write(
        tmp_path, "default.json",
        summary={"mean_fama": 1.0, "mean_token_savings_ratio": 2.0},
        results=[{
            "user_id": "trace_x", "fama": {"fama": 1.0}, "engine_tokens": 10,
            "baseline_tokens": 20, "token_savings_ratio": 2.0,
        }],
    )
    recency_path = _write(
        tmp_path, "recency.json",
        summary={"mean_fama": 0.7, "mean_token_savings_ratio": 1.5},
        results=[{
            "user_id": "trace_x", "fama": {"fama": 0.7}, "engine_tokens": 12,
            "baseline_tokens": 20, "token_savings_ratio": 1.5,
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

    table = render_compare(default_path, recency_path, no_forgetting_path)

    assert "trace_x" in table
    assert "| trace_x | 1.0 | 0.7 | 0.5 | 10 | 12 | 20 | 2.0x |" in table
    assert "default (engine) | 1.0 | 2.0x" in table
    assert "recency-only (naive baseline) | 0.7 | 1.5x" in table
    assert "no-forgetting (ablation) | 0.5 | 1.0x" in table
    assert "FAMA gap (default" in table


def test_render_compare_never_recomputes_scores_it_just_formats_the_files(tmp_path):
    # A control-style tie at 1.0 across all three — proves the function reads
    # stored fama values, not something derived from engine/baseline tokens.
    default_path = _write(
        tmp_path, "default.json",
        summary={"mean_fama": 1.0, "mean_token_savings_ratio": 3.0},
        results=[{
            "user_id": "trace_y", "fama": {"fama": 1.0}, "engine_tokens": 5,
            "baseline_tokens": 15, "token_savings_ratio": 3.0,
        }],
    )
    recency_path = _write(
        tmp_path, "recency.json",
        summary={"mean_fama": 1.0, "mean_token_savings_ratio": 1.0},
        results=[{
            "user_id": "trace_y", "fama": {"fama": 1.0}, "engine_tokens": 15,
            "baseline_tokens": 15, "token_savings_ratio": 1.0,
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

    table = render_compare(default_path, recency_path, no_forgetting_path)

    assert "| trace_y | 1.0 | 1.0 | 1.0 | 5 | 15 | 15 | 3.0x |" in table


def test_render_compare_skips_traces_missing_from_a_baseline_file(tmp_path):
    # Defensive case: if committed files ever diverge (shouldn't happen for
    # same-freeze traces, but the merge must not crash).
    default_path = _write(
        tmp_path, "default.json",
        summary={"mean_fama": 1.0, "mean_token_savings_ratio": 1.0},
        results=[
            {"user_id": "trace_a", "fama": {"fama": 1.0}, "engine_tokens": 1, "baseline_tokens": 1, "token_savings_ratio": 1.0},
            {"user_id": "trace_missing", "fama": {"fama": 1.0}, "engine_tokens": 1, "baseline_tokens": 1, "token_savings_ratio": 1.0},
        ],
    )
    recency_path = _write(
        tmp_path, "recency.json",
        summary={"mean_fama": 1.0, "mean_token_savings_ratio": 1.0},
        results=[
            {"user_id": "trace_a", "fama": {"fama": 1.0}, "engine_tokens": 1, "baseline_tokens": 1, "token_savings_ratio": 1.0},
        ],
    )
    no_forgetting_path = _write(
        tmp_path, "no-forgetting.json",
        summary={"mean_fama": 1.0, "mean_token_savings_ratio": 1.0},
        results=[
            {"user_id": "trace_a", "fama": {"fama": 1.0}, "engine_tokens": 1, "baseline_tokens": 1, "token_savings_ratio": 1.0},
        ],
    )

    table = render_compare(default_path, recency_path, no_forgetting_path)

    assert "trace_a" in table
    assert "trace_missing" not in table
