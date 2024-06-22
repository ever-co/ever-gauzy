import { registerAs } from '@nestjs/config';

/**
 * i4net AI Configuration
 */
export default registerAs('guazyAI', () => ({
	// GraphQL endpoint for i4net AI
	gauzyAIGraphQLEndpoint: process.env.I4NET_AI_GRAPHQL_ENDPOINT || null,
	// REST endpoint for i4net AI
	gauzyAIRESTEndpoint: process.env.I4NET_AI_REST_ENDPOINT || null,
	// Request timeout for i4net AI in milliseconds
	gauzyAIRequestTimeout: parseInt(process.env.i4net_AI_REQUEST_TIMEOUT) || 60 * 5 * 1000,
	// i4net AI API keys Pair
	gauzyAiApiKey: process.env.I4NET_AI_API_KEY || null,
	gauzyAiApiSecret: process.env.I4NET_AI_API_SECRET || null
}));
