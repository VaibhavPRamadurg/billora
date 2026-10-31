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

## Registration

`POST /api/v1/auth/register` creates a public customer account. The request accepts an
email address and password only; a client cannot choose `admin` or `staff` roles.

```json
{
  "email": "customer@example.com",
  "password": "at-least-eight-characters"
}
```

Successful responses return HTTP 201 and never include password hashes:

```json
{
  "id": "8fdf9e75-cf5d-4f01-a1e1-8ae86af5d9ef",
  "email": "customer@example.com",
  "role": "customer",
  "is_active": true,
  "created_at": "2026-10-31T10:15:30Z",
  "updated_at": "2026-10-31T10:15:30Z"
}
```

Duplicate normalized emails return HTTP 409. Invalid email addresses, passwords shorter
than eight characters, missing required fields, and role fields submitted by public
clients return HTTP 422.
