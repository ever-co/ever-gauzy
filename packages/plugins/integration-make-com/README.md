# @gauzy/plugin-integration-make-com

This library was generated with [Nx](https://nx.dev).

## Overview

The Integration Make.com plugin is a Gauzy plugin that provides a user-friendly interface for integrating Make.com with the Gauzy platform. This integration allows you to automate workflows and connect Gauzy with other applications through Make.com's powerful automation platform.

## Features

-   OAuth2 authentication with Make.com
-   Webhook integration for real-time event notifications
-   Timer event synchronization
-   Organization and tenant-level integration settings
-   Secure credential management

## Integration Settings

The plugin supports the following integration settings:

1. **Webhook Configuration**

    - `webhookUrl`: The Make.com webhook URL for receiving events
    - `isEnabled`: Toggle to enable/disable the integration

2. **OAuth Settings**
    - `client_id`: Your Make.com application client ID
    - `client_secret`: Your Make.com application client secret
    - `access_token`: OAuth access token (automatically managed)
    - `refresh_token`: OAuth refresh token (automatically managed)

## Setup Instructions

1. **Create a Make.com Application**

    - Go to Make.com and create a new application
    - Configure the OAuth redirect URL: `{API_BASE_URL}/api/integration/make-com/oauth/callback`
    - Note down your client ID and client secret

2. **Install the Plugin**

    ```bash
    npm install @gauzy/plugin-integration-make-com
    # or
    yarn add @gauzy/plugin-integration-make-com
    ```

3. **Configure Integration Settings**

    - Navigate to your Gauzy instance's integration settings
    - Select Make.com integration
    - Enter your Make.com client ID and client secret
    - Authorize the integration through the OAuth flow
    - Configure your webhook URL from Make.com

4. **Environment Variables**
   The following environment variables can be configured:
    - `GAUZY_MAKE_BASE_URL`: Make.com API base URL (default: https://www.make.com)
    - `GAUZY_MAKE_POST_INSTALL_URL`: URL to redirect after installation
    - `GAUZY_MAKE_REDIRECT_URL`: OAuth redirect URL

## Building

Run `yarn nx build plugin-integration-make-com` to build the library.

## Running unit tests

Run `yarn nx test plugin-integration-make-com` to execute the unit tests via [Jest](https://jestjs.io).

## Publishing

After building your library with `yarn nx build plugin-integration-make-com`, go to the dist folder `cd dist/packages/plugins/integration-make-com` and run `npm publish`.

## Security

-   All sensitive credentials are encrypted before storage
-   OAuth tokens are automatically refreshed when expired
-   Integration settings are scoped to specific tenants and organizations

## Support

For issues and feature requests, please visit our [GitHub repository](https://github.com/ever-co/ever-gauzy).
