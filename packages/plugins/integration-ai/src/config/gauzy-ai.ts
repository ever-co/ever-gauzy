import { registerAs } from '@nestjs/config';

/**
 * Gauzy AI Configuration
 */
export default registerAs('guazyAI', () => ({
	// GraphQL endpoint for Gauzy AI
	gauzyAIGraphQLEndpoint: process.env.GAUZY_AI_GRAPHQL_ENDPOINT || null,
	// REST endpoint for Gauzy AI
	gauzyAIRESTEndpoint: process.env.GAUZY_AI_REST_ENDPOINT || null,
	// Request timeout for Gauzy AI in milliseconds
	gauzyAIRequestTimeout: parseInt(process.env.GAUZY_AI_REQUEST_TIMEOUT) || 60 * 5 * 1000,
	// Gauzy AI API keys Pair
	gauzyAiApiKey: process.env.GAUZY_AI_API_KEY || null,
	gauzyAiApiSecret: process.env.GAUZY_AI_API_SECRET || null
}));
