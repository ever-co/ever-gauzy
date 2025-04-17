import { registerAs } from '@nestjs/config';
import { environment } from '@gauzy/config';

const { gauzyAI } = environment;

/**
 * AI Configuration
 */
export default registerAs('gauzyAI', () => ({
	gauzyAIGraphQLEndpoint: gauzyAI?.graphQLEndpoint || null, // GraphQL endpoint for AI
	gauzyAIRESTEndpoint: gauzyAI?.restEndpoint || null, // REST endpoint for AI
	gauzyAIRequestTimeout: gauzyAI?.requestTimeout || 60 * 5 * 1000, // Request timeout for AI in milliseconds
	gauzyAiApiKey: gauzyAI?.apiKey || null, // AI API key
	gauzyAiApiSecret: gauzyAI?.apiSecret || null // AI API secret
}));
