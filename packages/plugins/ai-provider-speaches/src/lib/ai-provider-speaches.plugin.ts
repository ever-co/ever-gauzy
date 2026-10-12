import { GauzyCorePlugin as Plugin } from '@gauzy/plugin';
import { BaseAiProviderPlugin } from '@gauzy/plugin-ai-chat';
import { speachesProviderDefinition } from './ai-provider-speaches.provider';

/**
 * AiProviderSpeachesPlugin
 *
 * Contributes the Speaches provider to the AI chat engine
 * (`@gauzy/plugin-ai-chat`) by registering {@link speachesProviderDefinition}
 * with the provider registry on bootstrap (see {@link BaseAiProviderPlugin}).
 */
@Plugin({})
export class AiProviderSpeachesPlugin extends BaseAiProviderPlugin {
	protected readonly definition = speachesProviderDefinition;
}
