import { GauzyCorePlugin as Plugin } from '@gauzy/plugin';
import { BaseAiProviderPlugin } from '@gauzy/plugin-ai-chat';
import { openAiProviderDefinition } from './ai-provider-openai.provider';

/**
 * AiProviderOpenAiPlugin
 *
 * Contributes the OpenAI provider to the AI chat engine
 * (`@gauzy/plugin-ai-chat`) by registering {@link openAiProviderDefinition}
 * with the provider registry on bootstrap (see {@link BaseAiProviderPlugin}).
 */
@Plugin({})
export class AiProviderOpenAiPlugin extends BaseAiProviderPlugin {
	protected readonly definition = openAiProviderDefinition;
}
