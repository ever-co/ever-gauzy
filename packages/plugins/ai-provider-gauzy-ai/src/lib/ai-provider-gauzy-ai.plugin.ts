import { GauzyCorePlugin as Plugin } from '@gauzy/plugin';
import { BaseAiProviderPlugin } from '@gauzy/plugin-ai-chat';
import { gauzyAiProviderDefinition } from './ai-provider-gauzy-ai.provider';

/**
 * AiProviderGauzyAiPlugin
 *
 * Contributes the Gauzy AI (placeholder — chat not routed yet) provider to the AI chat engine
 * (`@gauzy/plugin-ai-chat`) by registering {@link gauzyAiProviderDefinition}
 * with the provider registry on bootstrap (see {@link BaseAiProviderPlugin}).
 */
@Plugin({})
export class AiProviderGauzyAiPlugin extends BaseAiProviderPlugin {
	protected readonly definition = gauzyAiProviderDefinition;
}
