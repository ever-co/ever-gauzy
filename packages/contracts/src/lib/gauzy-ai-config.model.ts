export interface IGauzyAIConfig {
	gauzy_ai_graphql_endpoint?: string;
	gauzy_ai_rest_endpoint?: string;
	gauzy_ai_api_key?: string;
}

export const GAUZY_AI_CONFIG_KEYS = [
	'gauzy_ai_graphql_endpoint',
	'gauzy_ai_rest_endpoint',
	'gauzy_ai_api_key'
] as const;
