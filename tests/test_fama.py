def test_fama_perfect_recall_and_forgetting_scores_one():
    from eval.fama import compute_fama
    result = compute_fama(valid_surfaced=10, valid_total=10, obsolete_excluded=5, obsolete_total=5)
    assert result["mpa"] == 1.0
    assert result["faa"] == 1.0
    assert result["fama"] == 1.0


def test_fama_penalizes_surfacing_obsolete_memories():
    from eval.fama import compute_fama
    result = compute_fama(valid_surfaced=10, valid_total=10, obsolete_excluded=2, obsolete_total=4)
    assert result["faa"] == 0.5
    assert result["fama"] < 1.0


def test_fama_never_goes_negative():
    from eval.fama import compute_fama
    result = compute_fama(valid_surfaced=0, valid_total=10, obsolete_excluded=0, obsolete_total=10)
    assert result["fama"] >= 0.0
