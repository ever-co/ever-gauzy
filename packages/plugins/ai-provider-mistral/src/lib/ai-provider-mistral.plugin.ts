import { GauzyCorePlugin as Plugin } from '@gauzy/plugin';
import { BaseAiProviderPlugin } from '@gauzy/plugin-ai-chat';
import { mistralProviderDefinition } from './ai-provider-mistral.provider';

/**
 * AiProviderMistralPlugin
 *
 * Contributes the Mistral provider to the AI chat engine
 * (`@gauzy/plugin-ai-chat`) by registering {@link mistralProviderDefinition}
 * with the provider registry on bootstrap (see {@link BaseAiProviderPlugin}).
 */
@Plugin({})
export class AiProviderMistralPlugin extends BaseAiProviderPlugin {
	protected readonly definition = mistralProviderDefinition;
}
