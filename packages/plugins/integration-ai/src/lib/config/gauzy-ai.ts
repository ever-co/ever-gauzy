import { registerAs } from '@nestjs/config';
import { environment } from '@gauzy/config';

const { gauzyAI } = environment;

/**
 * Gauzy AI Configuration
 */
export default registerAs('gauzyAI', () => ({
	gauzyAIGraphQLEndpoint: gauzyAI?.graphQLEndpoint || null, // GraphQL endpoint for Gauzy AI
	gauzyAIRESTEndpoint: gauzyAI?.restEndpoint || null, // REST endpoint for Gauzy AI
	gauzyAIRequestTimeout: gauzyAI?.requestTimeout || 60 * 5 * 1000, // Request timeout for Gauzy AI in milliseconds
	gauzyAiApiKey: gauzyAI?.apiKey || null, // Gauzy AI API key
	gauzyAiApiSecret: gauzyAI?.apiSecret || null // Gauzy AI API secret
}));
