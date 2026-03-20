/**
 * Setting name constants for the Plane integration.
 * These are stored as `settingsName` in the `integration_setting` table.
 */
export enum PlaneSettingName {
	/** Main Plane web app URL */
	PLANE_WEB_URL = 'PLANE_WEB_URL',

	/** Plane admin panel URL */
	PLANE_ADMIN_URL = 'PLANE_ADMIN_URL',

	/** Plane public space URL */
	PLANE_SPACE_URL = 'PLANE_SPACE_URL',

	/** Reference to the TenantApiKey record ID */
	PLANE_API_KEY_ID = 'PLANE_API_KEY_ID',

	/** Whether the integration is enabled */
	IS_ENABLED = 'IS_ENABLED'
}
