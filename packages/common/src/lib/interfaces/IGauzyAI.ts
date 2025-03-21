/**
 * Gauzy AI Configuration
 */
export interface IGauzyAIConfig {
	readonly apiKey?: string;
	readonly apiSecret?: string;
	readonly graphQLEndpoint?: string;
	readonly restEndpoint?: string;
	readonly requestTimeout?: number;
}
