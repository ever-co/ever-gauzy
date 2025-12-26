# Security Policy

Contact: <mailto:security@ever.co>

Ever Gauzy™ follows good security practices, but 100% security cannot be guaranteed in any software!
Ever Gauzy™ is provided AS IS without any warranty. Use at your own risk!
See more details in the [LICENSE](LICENSE.md).

In a production setup, all client-side to server-side (backend, APIs) communications should be encrypted using HTTPS/WSS/SSL (REST APIs, GraphQL endpoint, Socket.io WebSockets, etc.).

If you discover any issue regarding security, please disclose the information responsibly by sending an email to <mailto:security@ever.co> and not by creating a GitHub issue.

## CVE Clarifications

### CVE-2023-53951 (JWT Weak HMAC Secret)

⚠️ **CVE-2023-53951** refers to our **PUBLIC DEMO environment** (`demo.gauzy.co` / `apidemo.gauzy.co`), which intentionally uses default credentials and secrets for testing purposes. This is expected behavior for a demo environment meant to allow public access and evaluation of the software.

**Production deployments should always use strong, unique secrets configured via environment variables** (e.g., `JWT_SECRET`, `JWT_REFRESH_SECRET`). See our [environment configuration documentation](.env.sample) for all required security-related environment variables.
