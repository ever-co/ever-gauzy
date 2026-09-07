import { GauzyCorePlugin as Plugin } from '@gauzy/plugin';
import { BaseAiProviderPlugin } from '@gauzy/plugin-ai-chat';
import { elevenLabsProviderDefinition } from './ai-provider-elevenlabs.provider';

/**
 * AiProviderElevenLabsPlugin
 *
 * Contributes the ElevenLabs provider to the AI chat engine
 * (`@gauzy/plugin-ai-chat`) by registering {@link elevenLabsProviderDefinition}
 * with the provider registry on bootstrap (see {@link BaseAiProviderPlugin}).
 */
@Plugin({})
export class AiProviderElevenLabsPlugin extends BaseAiProviderPlugin {
	protected readonly definition = elevenLabsProviderDefinition;
}
