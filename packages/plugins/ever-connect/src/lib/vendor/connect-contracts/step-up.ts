// Vendored from github.com/ever-co/ever-connect-sdk@62c3fa0a5a0b1b487de860cb2b714505caeeb7bf (packages/ts/connect-contracts/src/step-up.ts) by scripts/vendor-connect-sdk.mjs. Do not edit.
// @ts-nocheck: type-checked by the SDK's own strict build.
/**
 * Types for the in-product consent dialog: the fresh Ever ID sign-in (step-up) a product asks for
 * through its own client, and the consent write it then sends with that token. Types and pure
 * checks only; this package makes no request.
 */
import type { components, operations } from './generated/ever-platform.v1';
import type { IntegrationKey } from './generated/integrations';

/** How old a step-up sign-in may be when the consent write arrives, in seconds. */
export const STEP_UP_MAX_AGE_S = 300;

/** The parameters every step-up authorization request carries. */
export const STEP_UP_REQUEST_DEFAULTS = {
  response_type: 'code',
  prompt: 'login',
  max_age: STEP_UP_MAX_AGE_S,
  code_challenge_method: 'S256',
} as const;

/**
 * The OpenID Connect authorization request of a step-up sign-in: a fresh sign-in (`prompt=login`,
 * `max_age=300`) with PKCE through the installation's own client (or, on an installation Ever
 * operates, the product's client), asking for the Ever Platform API audience.
 */
export interface StepUpAuthorizationRequest {
  readonly response_type: typeof STEP_UP_REQUEST_DEFAULTS.response_type;
  readonly client_id: string;
  readonly redirect_uri: string;
  readonly scope: string;
  readonly prompt: typeof STEP_UP_REQUEST_DEFAULTS.prompt;
  readonly max_age: typeof STEP_UP_REQUEST_DEFAULTS.max_age;
  readonly code_challenge: string;
  readonly code_challenge_method: typeof STEP_UP_REQUEST_DEFAULTS.code_challenge_method;
  readonly state: string;
  readonly nonce: string;
  /** The Ever Platform API audience the token must carry. */
  readonly audience: string;
}

/** The claims of a step-up token a product checks before it sends the consent write. */
export interface StepUpTokenClaims {
  readonly iss: string;
  readonly sub: string;
  readonly aud: string | readonly string[];
  /** The client that asked for the token: the installation's own client. */
  readonly azp: string;
  /** When the person signed in (seconds); at most STEP_UP_MAX_AGE_S old. */
  readonly auth_time: number;
  readonly iat: number;
  readonly exp: number;
}

/**
 * The body of the in-product consent write
 * (`PUT /v1/orgs/{org}/instances/{instance}/integrations/{key}`):
 * `{enabled, tenant_link_id?, consent: {scope_version, dpa_version, accepted, screen_version?, ui_locale?}}`.
 */
export type StepUpGrantBody = components['schemas']['IntegrationPut'];

/** The state the consent write answers (`consent_source: product_ui` for a step-up consent). */
export type StepUpGrantResponse = operations['putIntegrationState']['responses'][200]['content']['application/json'];

/** Integration keys that never take an in-product consent: they are enabled in app.ever.co only. */
export const STEP_UP_EXCLUDED_KEYS = ['counterparty_discoverable', 'instance_url'] as const satisfies readonly IntegrationKey[];

/** Whether an integration may be consented in the product's own dialog. */
export const stepUpAllowed = (key: IntegrationKey): boolean => !(STEP_UP_EXCLUDED_KEYS as readonly string[]).includes(key);

/**
 * Whether a step-up sign-in is fresh enough at `nowS` (seconds): at most `maxAgeS` old and not
 * from the future (60 s of clock skew allowed).
 */
export function isStepUpFresh(claims: Pick<StepUpTokenClaims, 'auth_time'>, nowS: number, maxAgeS: number = STEP_UP_MAX_AGE_S): boolean {
  const t = claims.auth_time;
  return Number.isInteger(t) && nowS - t <= maxAgeS && t <= nowS + 60;
}
