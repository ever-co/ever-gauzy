import { registerAs } from '@nestjs/config';

export default registerAs('guazyAI', () => ({
	gauzyAIGraphQLEndpoint: process.env.GAUZY_AI_GRAPHQL_ENDPOINT,
	gauzyAIRESTEndpoint: process.env.GAUZY_AI_REST_ENDPOINT,
	gauzyAIRequestTimeout: parseInt(process.env.GAUZY_AI_REQUEST_TIMEOUT) || 60 * 5 * 1000,

	// Gauzy AI API keys Pair
	gauzyAiApiKey: process.env.GAUZY_AI_API_KEY || '',
	gauzyAiApiSecret: process.env.GAUZY_AI_API_SECRET || ''
}));
