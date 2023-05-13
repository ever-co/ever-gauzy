import { registerAs } from '@nestjs/config';

export default registerAs('guazyAI', () => ({
	gauzyAIEndpoint: process.env.GAUZY_AI_ENDPOINT,
	gauzyAIGraphQLEndpoint: process.env.GAUZY_AI_GRAPHQL_ENDPOINT,
	gauzyAIRequestTimeout: parseInt(process.env.GAUZY_AI_REQUEST_TIMEOUT) || 60 * 5 * 1000,
}));
