import { GauzyCorePlugin as Plugin } from '@gauzy/plugin';
import { BaseAiProviderPlugin } from '@gauzy/plugin-ai-chat';
import { deepgramProviderDefinition } from './ai-provider-deepgram.provider';

/**
 * AiProviderDeepgramPlugin
 *
 * Contributes the Deepgram provider to the AI chat engine
 * (`@gauzy/plugin-ai-chat`) by registering {@link deepgramProviderDefinition}
 * with the provider registry on bootstrap (see {@link BaseAiProviderPlugin}).
 */
@Plugin({})
export class AiProviderDeepgramPlugin extends BaseAiProviderPlugin {
	protected readonly definition = deepgramProviderDefinition;
}
