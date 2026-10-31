# API Contract

## Conventions

- Base API prefix: `/api/v1`
- Primary resource identifiers are UUIDs.
- JSON property names use `snake_case`.
- Decimal monetary amounts are serialized as strings, for example `"19.99"`, to avoid precision loss.
- Timestamps use UTC ISO 8601 format, for example `2026-10-31T10:15:30Z`.
- Protected endpoints use JWT Bearer authentication: `Authorization: Bearer <token>`.

## Errors

Product endpoints should consistently return:

```json
{
  "detail": "Human-readable explanation",
  "code": "machine_readable_error_code"
}
```

Use an appropriate HTTP status code. FastAPI validation responses may use the framework default until the team introduces a shared validation error adapter.
