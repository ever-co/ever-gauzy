import { registerAs } from '@nestjs/config';

/**
 * Gauzy AI Configuration
 */
export default registerAs('gauzyAI', () => ({
	gauzyAIGraphQLEndpoint: process.env.GAUZY_AI_GRAPHQL_ENDPOINT || null, // GraphQL endpoint for Gauzy AI
	gauzyAIRESTEndpoint: process.env.GAUZY_AI_REST_ENDPOINT || null, // REST endpoint for Gauzy AI
	gauzyAIRequestTimeout: parseInt(process.env.GAUZY_AI_REQUEST_TIMEOUT) || 60 * 5 * 1000, // Request timeout for Gauzy AI in milliseconds
	gauzyAiApiKey: process.env.GAUZY_AI_API_KEY || null, // Gauzy AI API key
	gauzyAiApiSecret: process.env.GAUZY_AI_API_SECRET || null // Gauzy AI API secret
}));
