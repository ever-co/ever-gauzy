import { GauzyCorePlugin as Plugin } from '@gauzy/plugin';
import { BaseAiProviderPlugin } from '@gauzy/plugin-ai-chat';
import { openAiCompatibleProviderDefinition } from './ai-provider-openai-compatible.provider';

/**
 * AiProviderOpenAiCompatiblePlugin
 *
 * Contributes the OpenAI-compatible provider to the AI chat engine
 * (`@gauzy/plugin-ai-chat`) by registering {@link openAiCompatibleProviderDefinition}
 * with the provider registry on bootstrap (see {@link BaseAiProviderPlugin}).
 */
@Plugin({})
export class AiProviderOpenAiCompatiblePlugin extends BaseAiProviderPlugin {
	protected readonly definition = openAiCompatibleProviderDefinition;
}
