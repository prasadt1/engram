from unittest.mock import MagicMock, patch

from openai import APIStatusError

from app import qwen_client


def _fake_chunk(delta_content):
    chunk = MagicMock()
    chunk.choices = [MagicMock(delta=MagicMock(content=delta_content))]
    return chunk


def test_chat_fast_stream_yields_only_non_empty_deltas():
    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = iter([
        _fake_chunk("Hello"),
        _fake_chunk(None),  # e.g. a role-only chunk with no text
        _fake_chunk(" world"),
    ])

    with patch("app.qwen_client._client", return_value=fake_client):
        deltas = list(qwen_client.chat_fast_stream("prompt", system="sys"))

    assert deltas == ["Hello", " world"]
    kwargs = fake_client.chat.completions.create.call_args.kwargs
    assert kwargs["model"] == qwen_client.config.MODEL_FAST
    assert kwargs["stream"] is True
    assert kwargs["messages"][0] == {"role": "system", "content": "sys"}
    assert kwargs["messages"][1] == {"role": "user", "content": "prompt"}


def test_chat_fast_stream_falls_back_to_secondary_model_on_404():
    not_found = APIStatusError(
        "model not found", response=MagicMock(status_code=404), body=None,
    )
    not_found.status_code = 404
    fake_client = MagicMock()
    fake_client.chat.completions.create.side_effect = [
        not_found,
        iter([_fake_chunk("fallback reply")]),
    ]

    with patch("app.qwen_client._client", return_value=fake_client):
        deltas = list(qwen_client.chat_fast_stream("prompt"))

    assert deltas == ["fallback reply"]
    second_call_kwargs = fake_client.chat.completions.create.call_args_list[1].kwargs
    assert second_call_kwargs["model"] == qwen_client.config.MODEL_FAST_FALLBACK


def test_chat_vision_passes_explicit_timeout():
    fake_result = MagicMock()
    with patch("app.qwen_client._call", return_value=fake_result) as mock_call:
        qwen_client.chat_vision("data:image/jpeg;base64,xxx", "prompt")

    # chat_vision() passes timeout=60.0 to _call() explicitly as a kwarg.
    # Mocking _call() directly (rather than _client) matters here: _call's
    # own default `timeout` parameter is also 60.0, so asserting against a
    # mocked _client would pass even if chat_vision stopped passing timeout
    # at all (the default would silently produce the same 60.0). Asserting
    # on mock_call.call_args instead only passes if chat_vision genuinely
    # passed timeout=60.0 itself.
    assert mock_call.call_args.kwargs["timeout"] == 60.0


def test_chat_fast_passes_explicit_timeout():
    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="ok"))],
        usage=MagicMock(prompt_tokens=1, completion_tokens=1),
    )
    with patch("app.qwen_client._client", return_value=fake_client) as mock_client_factory:
        qwen_client.chat_fast("prompt")

    assert mock_client_factory.call_args.args[1] == 30.0
