import { GauzyCorePlugin as Plugin } from '@gauzy/plugin';
import { BaseAiProviderPlugin } from '@gauzy/plugin-ai-chat';
import { anthropicProviderDefinition } from './ai-provider-anthropic.provider';

/**
 * AiProviderAnthropicPlugin
 *
 * Contributes the Anthropic (Claude) provider to the AI chat engine
 * (`@gauzy/plugin-ai-chat`) by registering {@link anthropicProviderDefinition}
 * with the provider registry on bootstrap (see {@link BaseAiProviderPlugin}).
 */
@Plugin({})
export class AiProviderAnthropicPlugin extends BaseAiProviderPlugin {
	protected readonly definition = anthropicProviderDefinition;
}
