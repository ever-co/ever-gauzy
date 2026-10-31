import { Provider } from '@nestjs/common';
import { EVER_CONNECT_CONFIG } from '@gauzy/plugin-auth-zitadel';
import { EverIdLoginHandler } from './handlers/ever-id-login.handler';

/**
 * `EVER_CONNECT_CONFIG`, the optional port of the Ever ID sign-in plugin: its issuer and client from
 * Sign in with Ever ID (environment settings win, key by key), whether the integration is enabled,
 * and Ever Platform's view of an identity for a token without the platform's claims.
 */
export const EVER_CONNECT_CONFIG_PROVIDER: Provider = { provide: EVER_CONNECT_CONFIG, useExisting: EverIdLoginHandler };
