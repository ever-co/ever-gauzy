// Vendored from github.com/ever-co/ever-connect-sdk@62c3fa0a5a0b1b487de860cb2b714505caeeb7bf (packages/ts/connect-contracts/src/index.ts) by scripts/vendor-connect-sdk.mjs. Do not edit.
// @ts-nocheck: type-checked by the SDK's own strict build.
/**
 * @ever-co/connect-contracts: the wire contracts between an installation of an Ever product and
 * Ever Platform. Types, JSON Schemas, integration definitions, constants and the outbound-call
 * table, generated from the contract files of this repository. No runtime dependencies, no
 * request code, nothing runs at import.
 */
import type { components } from './generated/ever-platform.v1';

export type { Constants, Product } from './generated/constants';
export { CONSTANTS, FEED_EVENT_TYPES } from './generated/constants';
export type { components, operations, paths } from './generated/ever-platform.v1';
export type { IntegrationDefinition, IntegrationKey, IntegrationScopeRow } from './generated/integrations';
export { INTEGRATION_KEYS, INTEGRATIONS } from './generated/integrations';
export type { OutboundCallEndpoint, OutboundCallRow, RowCoverage } from './generated/rows';
export { ROW_COVERAGE, ROWS } from './generated/rows';
export type {
  ConsentV1,
  EntitlementV1,
  EventDataByType,
  FeedEventType,
  JsonSchemaDocument,
  KeyManifestV1,
  StatsReportV1,
  UsageReportV1,
} from './generated/schemas';
export { EVENT_SCHEMAS, SCHEMAS } from './generated/schemas';
export type { FieldError, Problem, ProblemCode } from './problem';
export { isProblem, PENDING_PROBLEM_CODES, PROBLEM_CODES, PROBLEM_TYPE_PREFIX, problemType } from './problem';
export type {
  StepUpAuthorizationRequest,
  StepUpGrantBody,
  StepUpGrantResponse,
  StepUpTokenClaims,
} from './step-up';
export {
  isStepUpFresh,
  STEP_UP_EXCLUDED_KEYS,
  STEP_UP_MAX_AGE_S,
  STEP_UP_REQUEST_DEFAULTS,
  stepUpAllowed,
} from './step-up';

/** Every component schema of the contract, by name. */
export type Schemas = components['schemas'];

/** Bodies a product sends and receives, by contract schema name. */
export type RedeemRequest = Schemas['RedeemRequest'];
export type RedeemResponse = Schemas['RedeemResponse'];
export type TokenRequest = Schemas['TokenRequest'];
export type TokenResponse = Schemas['TokenResponse'];
export type HeartbeatBody = Schemas['HeartbeatBody'];
export type FeedResponse = Schemas['FeedResponse'];
export type FeedAck = Schemas['FeedAck'];
export type EventEnvelope = Schemas['EventEnvelope'];
export type TenantLinkCreate = Schemas['TenantLinkCreate'];
export type StatsLinkCreate = Schemas['StatsLinkCreate'];
export type InstanceIntegrationPut = Schemas['InstanceIntegrationPut'];
export type IntegrationPut = Schemas['IntegrationPut'];
export type ManagedOperationResult = Schemas['ManagedOperationResult'];
export type KeyManifestBody = Schemas['KeyManifestBody'];
