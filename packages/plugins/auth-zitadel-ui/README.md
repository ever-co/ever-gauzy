<!-- markdownlint-configure-file
{
  "MD043": {
    "headings": [
      "# @gauzy/plugin-auth-zitadel-ui",
      "## Pages",
      "## Build and test"
    ]
  }
}
-->

# @gauzy/plugin-auth-zitadel-ui

The web app side of Ever ID sign-in (`@gauzy/plugin-auth-zitadel`).

## Pages

- `#/auth/ever-id`: redeems the one-time key of an Ever ID sign-in and signs
  in to the chosen workspace.
- `#/auth/ever-id/confirm`: Gauzy's one-time e-mail code before an Ever ID is
  connected to a matching account (Ever Cloud only).
- `#/auth/ever-id/signup`: "Create a Gauzy workspace with this Ever ID" (Ever
  Cloud only).
- Settings > Connected identities: connect, list and disconnect the Ever IDs
  of the signed-in account.

The pages only receive opaque one-time keys and error codes in their URLs;
names and e-mail addresses are fetched from the API with those keys.

The Settings entry stays hidden unless the web app has `ZITADEL_AUTH_LINK`
set and the API reports Ever ID sign-in as enabled
(`GET /api/auth/zitadel/config`); the Ever ID button on the login and
register pages lives in `@gauzy/ui-auth` and follows the same rule. The
sign-in pages are only reached from an Ever ID sign-in; opened directly
without a key they show the expiry message. Settings > Connected identities,
opened directly while Ever ID sign-in is off, says that it is not enabled.

## Build and test

```bash
yarn nx build plugin-auth-zitadel-ui
yarn nx test plugin-auth-zitadel-ui
```
