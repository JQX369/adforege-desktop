# Checklist: External API/Model Call

- Resource URL:
- Product/version or commit:
- Last-checked (UTC):
- Scope:

Review before coding:
- Auth method (keys/tokens), base URL, required headers
- Rate limits and backoff strategy
- Idempotency keys (for writes)
- Pagination and filtering
- Error model (HTTP/status, error codes, retryable vs non-retryable)
- Webhook signatures (if applicable)
- Test mode vs live mode considerations

Include examples:
- Minimal request/response (redact secrets)
- Edge cases and common failure responses

Post-implementation:
- Add link to code
- Add notes about quirks or gotchas
