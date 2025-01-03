/**
 * Configuration options for Jira integration.
 */
export interface IJiraIntegrationConfig {
	readonly appName: string;
	readonly appDescription: string;
	readonly appKey: string;
	readonly baseUrl: string;
	readonly vendorName: string;
	readonly vendorUrl: string;
}
