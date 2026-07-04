# Proof of Alibaba Cloud deployment

This document collects the evidence that Engram's backend runs on Alibaba Cloud, per the hackathon submission requirements.

## 1. Code files using Alibaba Cloud services and APIs

- **Alibaba OSS (object storage)** — [`app/storage.py`](../app/storage.py): the `OSSStorage` class uses the official `oss2` SDK against a private bucket in `ap-southeast-1`, with presigned read URLs (`sign_url`). Selected via `STORAGE_BACKEND=oss`.
- **Qwen Cloud / DashScope (managed model API)** — [`app/qwen_client.py`](../app/qwen_client.py): every model call in the product goes through Alibaba's OpenAI-compatible endpoint at `dashscope-intl.aliyuncs.com` (`qwen-vl-max`, `qwen3.7-max`, `qwen3.6-flash`; IDs in [`app/config.py`](../app/config.py)). No self-hosted weights anywhere.

## 2. Containerized deployment

The backend ships as a Docker image ([`Dockerfile`](../Dockerfile), [`docker-compose.yml`](../docker-compose.yml)) verified end-to-end in-container, including the `engram-mcp` subprocess path (`GET /api/v1/memory-stats?via=mcp` returns `"served_via": "engram-mcp"` from inside the image).

## 3. Live instance (ECS/SAS, Singapore)

> **Status: deployment in progress.** The Alibaba Cloud account's identity verification is under review; this section receives the console screenshot ("Running" state, `ap-southeast-1`), the public endpoint URL, and the deploy timestamp the moment the instance is live. Everything above is independent of that gate and verifiable in this repository today.

- Console screenshot: _pending_
- Public endpoint: _pending_
- Region: ap-southeast-1 (Singapore)
