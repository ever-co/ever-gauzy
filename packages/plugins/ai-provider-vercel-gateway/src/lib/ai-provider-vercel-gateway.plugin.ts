import { GauzyCorePlugin as Plugin } from '@gauzy/plugin';
import { BaseAiProviderPlugin } from '@gauzy/plugin-ai-chat';
import { vercelGatewayProviderDefinition } from './ai-provider-vercel-gateway.provider';

/**
 * AiProviderVercelGatewayPlugin
 *
 * Contributes the Vercel AI Gateway provider to the AI chat engine
 * (`@gauzy/plugin-ai-chat`) by registering {@link vercelGatewayProviderDefinition}
 * with the provider registry on bootstrap (see {@link BaseAiProviderPlugin}).
 */
@Plugin({})
export class AiProviderVercelGatewayPlugin extends BaseAiProviderPlugin {
	protected readonly definition = vercelGatewayProviderDefinition;
}
