/**
 * Setting name constants for the Ever Async integration.
 * These are stored as `settingsName` in the `integration_setting` table.
 */
export enum EverAsyncSettingName {
	/** Base URL of the tenant's Ever Async server (e.g. https://async.example.com) */
	EVER_ASYNC_SERVER_URL = 'EVER_ASYNC_SERVER_URL',

	/**
	 * API token used to authenticate against the Ever Async server.
	 * WRITE-ONLY: accepted on setup/update, never returned by any read endpoint.
	 */
	EVER_ASYNC_API_TOKEN = 'EVER_ASYNC_API_TOKEN',

	/**
	 * JSON-serialized array of chat-user → employee mappings:
	 * `[{ "chatUserId": "U0123ABC", "employeeId": "<gauzy-employee-uuid>" }, ...]`.
	 * Mirrors `[connectors.gauzy.user_map]` in the Ever Async `everasync.toml`.
	 */
	EVER_ASYNC_USER_MAPPINGS = 'EVER_ASYNC_USER_MAPPINGS',

	/** Whether the integration is enabled */
	IS_ENABLED = 'IS_ENABLED'
}

/**
 * Integration name/provider used for the `IntegrationTenant` record.
 *
 * scaffold: add `EVER_ASYNC = 'Ever_Async'` to `IntegrationEnum` in
 * `packages/contracts/src/lib/integration.model.ts` during wiring, then replace
 * this constant with `IntegrationEnum.EVER_ASYNC` (mirrors `IntegrationEnum.PLANE`).
 */
export const EVER_ASYNC_INTEGRATION_NAME = 'Ever_Async';
