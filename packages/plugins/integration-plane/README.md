# integration-plane

This library was generated with [Nx](https://nx.dev).

## Building

Run `nx build integration-plane` to build the library.

## Plane proxy upstream

The Plane proxy is mounted inside this API, on `/api/plane`, and turns Plane UI calls into Gauzy API
calls. It sends those calls to this API process over loopback, on the address and port the API listens
on (`http://127.0.0.1:3000/api` for an API on `0.0.0.0:3000`), so they never leave the host.

| Variable                   | Default             | Meaning                                                                                                                                                    |
| -------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PLANE_PROXY_UPSTREAM_URL` | _(unset: loopback)_ | Gauzy API the proxy calls, in the same form as `API_BASE_URL` (an `/api` suffix is optional). Set it to reach Gauzy elsewhere, e.g. a cluster Service URL. |

The proxy no longer calls the public `API_BASE_URL`: that sent every call out through the CDN and back
in. To get that behaviour back, set `PLANE_PROXY_UPSTREAM_URL` to the public URL.

A proxy run on its own, outside Gauzy (`@ever-gauzy/plugin-integration-plane-api`), is not affected: it
still calls the Gauzy API set in its own `GAUZY_API_BASE_URL`.
