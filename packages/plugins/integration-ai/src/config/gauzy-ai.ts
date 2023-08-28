import { registerAs } from '@nestjs/config';

export default registerAs('guazyAI', () => ({
	gauzyAIGraphQLEndpoint: process.env.GAUZY_AI_GRAPHQL_ENDPOINT || null,
	gauzyAIRESTEndpoint: process.env.GAUZY_AI_REST_ENDPOINT || null,
	gauzyAIRequestTimeout: parseInt(process.env.GAUZY_AI_REQUEST_TIMEOUT) || 60 * 5 * 1000,

	// Gauzy AI API keys Pair
	gauzyAiApiKey: process.env.GAUZY_AI_API_KEY || null,
	gauzyAiApiSecret: process.env.GAUZY_AI_API_SECRET || null
}));
