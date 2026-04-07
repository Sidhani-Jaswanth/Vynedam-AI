# VYNEDAM AI Backend API

## Response Envelope
All endpoints return:

```json
{
  "success": true,
  "message": "",
  "data": {},
  "error": null
}
```

Compatibility fields are also exposed for existing frontend clients (`token`, `chat`, `chats`, `result`, etc.).

## Health
- `GET /health`
- `GET /ready`

## Auth
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Signup payload
```json
{
  "name": "John",
  "email": "john@example.com",
  "password": "Password123"
}
```

### Login payload
```json
{
  "email": "john@example.com",
  "password": "Password123"
}
```

### Refresh payload
```json
{
  "refreshToken": "<jwt>"
}
```

## Chats
Requires access token.

- `GET /api/chats`
- `POST /api/chats`
- `DELETE /api/chats`
- `GET /api/chats/:id?page=1&limit=50`
- `PATCH /api/chats/:id`
- `PATCH /api/chats/:id/pin`
- `POST /api/chats/:id/messages`
- `POST /api/chats/:id/clear`
- `DELETE /api/chats/:id`

### Add message payload
```json
{
  "sender": "user",
  "text": "Create a React app",
  "previewUrl": "",
  "downloadUrl": ""
}
```

## Generate
Auth requirements are environment-controlled.

- `GET /api/generate`
- `POST /api/generate`

### Generate payload
```json
{
  "prompt": "Build me a portfolio website",
  "messages": [
    { "role": "user", "content": "Build me a portfolio website" }
  ]
}
```

### Project response shape
When AI classifies prompt as project, `data.project` has:

```json
{
  "type": "project",
  "title": "Project Name",
  "files": [
    { "path": "src/App.js", "content": "..." }
  ],
  "previewUrl": "",
  "downloadUrl": ""
}
```

## Security Notes
- Access + refresh token flow with rotation
- Optional API key guard
- Route-specific rate limiting
- Helmet, HPP, Mongo sanitize, compression
- Request ID tracing

## Testing
- Unit: `npm test`
- Smoke: `npm run test:smoke`
