import { GauzyCorePlugin as Plugin } from '@gauzy/plugin';
import { BaseAiProviderPlugin } from '@gauzy/plugin-ai-chat';
import { groqProviderDefinition } from './ai-provider-groq.provider';

/**
 * AiProviderGroqPlugin
 *
 * Contributes the Groq provider to the AI chat engine
 * (`@gauzy/plugin-ai-chat`) by registering {@link groqProviderDefinition}
 * with the provider registry on bootstrap (see {@link BaseAiProviderPlugin}).
 */
@Plugin({})
export class AiProviderGroqPlugin extends BaseAiProviderPlugin {
	protected readonly definition = groqProviderDefinition;
}
