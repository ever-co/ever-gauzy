# Security Policy

Thank you for helping keep Ever® Gauzy™ and its users safe. This page explains how to report a security
vulnerability and what happens after you do.

## Supported versions

Security fixes are made on the `develop` branch and ship with the next release. We support:

| Version                                                                             | Supported |
| ----------------------------------------------------------------------------------- | --------- |
| The latest release ([releases](https://github.com/ever-co/ever-gauzy/releases))     | Yes       |
| The `develop` branch                                                                | Yes       |
| Older releases                                                                      | No: please upgrade to the latest release |

This covers everything in this repository: the API, the web app, the desktop apps (Gauzy Desktop, Gauzy Desktop
Timer, Gauzy Server), the plugins and the Docker images we publish from it (`ghcr.io/ever-co/gauzy-*`).

## Reporting a vulnerability

**Please do not report security vulnerabilities in public GitHub issues, discussions or pull requests.**

Report them privately, in one of these two ways:

1. **GitHub private vulnerability reporting (preferred):** open
   <https://github.com/ever-co/ever-gauzy/security/advisories/new>. Only you and the maintainers can see the report,
   and we can discuss it, prepare the fix in a private fork and publish the advisory from the same place.
2. **Email:** <mailto:security@ever.co>.

Please include as much of the following as you can:

-   the affected component (API endpoint, web page, desktop app, plugin, Docker image) and version or commit;
-   the type of issue (for example authentication bypass, missing authorization or tenant isolation, injection, XSS,
    SSRF, secret exposure);
-   step-by-step instructions to reproduce it, with a proof of concept if you have one;
-   the impact: what an attacker can do, and what access they need first;
-   any configuration the issue depends on (database type, `DEMO` mode, environment variables, reverse proxy).

Please test only against your own installation (for example a local `docker compose` stack). Do not test against
<https://app.gauzy.co> or other people's data, and do not run denial-of-service or spam tests against our services.

## What happens next

-   We acknowledge your report and keep you updated while we investigate and fix it.
-   We fix confirmed issues on `develop`, release the fix, and publish a GitHub Security Advisory (with a CVE when
    one applies) once a fixed release is available.
-   We credit reporters in the advisory, unless you ask us not to.
-   Please keep the details private until the advisory is published.

## Security notes for self-hosting

The production checklist (secrets the API refuses to start without, seeded account passwords, proxy trust and rate
limits) is in the [README](README.md#production). In production, serve every client-to-server connection (REST,
GraphQL, WebSockets) over HTTPS.
