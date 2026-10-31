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

## Login and authenticated profile

`POST /api/v1/auth/login` accepts the same normalized email and password fields as
registration. Invalid credentials and inactive accounts return HTTP 401.

```json
{
  "email": "customer@example.com",
  "password": "at-least-eight-characters"
}
```

Successful login response:

```json
{
  "access_token": "<signed-jwt>",
  "token_type": "bearer"
}
```

Use the token with protected endpoints, including `GET /api/v1/auth/me`:

```http
Authorization: Bearer <signed-jwt>
```

Tokens include the user UUID subject (`sub`), issued-at (`iat`), and expiration (`exp`)
claims and use `JWT_SECRET_KEY`, `JWT_ALGORITHM`, and `ACCESS_TOKEN_EXPIRE_MINUTES`
from the backend environment. Missing, invalid, expired, inactive-user, or
nonexistent-user tokens return HTTP 401. Authenticated users lacking a required role
return HTTP 403.

## Products and variants

All catalog endpoints require a Bearer token. Admins and staff can create and update;
only admins can delete. Customers can only retrieve active products and active variants
of active products. Catalog managers can also inspect inactive records.

| Method | Endpoint | Access |
| --- | --- | --- |
| `POST` | `/api/v1/products` | Admin, staff |
| `GET` | `/api/v1/products` | Authenticated users |
| `GET` | `/api/v1/products/{product_id}` | Authenticated users |
| `PATCH` | `/api/v1/products/{product_id}` | Admin, staff |
| `DELETE` | `/api/v1/products/{product_id}` | Admin |
| `POST` | `/api/v1/products/{product_id}/variants` | Admin, staff |
| `GET` | `/api/v1/products/{product_id}/variants` | Authenticated users |
| `GET` | `/api/v1/products/{product_id}/variants/{variant_id}` | Authenticated users |
| `PATCH` | `/api/v1/products/{product_id}/variants/{variant_id}` | Admin, staff |
| `DELETE` | `/api/v1/products/{product_id}/variants/{variant_id}` | Admin |

Create a product:

```json
{
  "name": "Premium support",
  "description": "Priority support coverage",
  "is_active": true
}
```

Create a variant:

```json
{
  "name": "Annual",
  "sku": "SUPPORT-ANNUAL",
  "attributes": {"term": "annual"},
  "is_active": true
}
```

List endpoints support `offset` and `limit` (1–100). Product listing additionally
supports `search` and, for admin/staff, `is_active`; variant listing supports
`is_active` for admin/staff. Product-variant ownership is always validated against the
URL's `product_id`.

Duplicate variant names within a product and duplicate non-null SKUs return HTTP 409.
Deleting a product or variant that is referenced by catalog composition or subscription
records returns HTTP 409 and the caller should deactivate it instead. Missing resources
return HTTP 404.
