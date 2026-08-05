import { AiProviderEnum } from '@gauzy/contracts';
import { IAiChatProviderDefinition, IAiProviderCredentials } from '@gauzy/plugin-ai-chat';

/** Stable provider id used by the registry, the UI and BYOK credentials. */
const PROVIDER_ID = AiProviderEnum.GAUZY_AI;

/**
 * Gauzy AI provider definition for the AI chat engine (placeholder).
 *
 * Registered with the {@link AiProviderRegistry} by {@link AiProviderGauzyAiPlugin}
 * so the provider is visible in the registry and the UI, but chat is NOT yet
 * routed through Gauzy AI — {@link IAiChatProviderDefinition.createModel}
 * intentionally throws until the Gauzy AI chat proxy is implemented
 * (see this plugin's README for the planned design).
 */
export const gauzyAiProviderDefinition: IAiChatProviderDefinition = {
	id: PROVIDER_ID,
	label: 'Gauzy AI',
	/**
	 * Deliberately EMPTY while `createModel` still throws.
	 *
	 * This used to be `['GAUZY_AI_API_KEY']`, which let this provider report itself
	 * `configured: true` — but that variable belongs to the unrelated `integration-ai`
	 * plugin (`packages/plugins/integration-ai/src/lib/config/gauzy-ai.ts`), so any
	 * operator using THAT integration silently made a non-functional chat provider look
	 * usable. Combined with `order: 10` (first in the registry's ascending sort), it could
	 * win default selection and fail every turn with 'not implemented yet'.
	 *
	 * Restore the variable in the same change that makes `createModel` return a real model.
	 */
	apiKeyEnvVars: [],
	baseUrlEnvVar: 'GAUZY_AI_BASE_URL',
	models: [],
	defaultModel: '',
	order: 10,
	websiteUrl: 'https://gauzy.ai',
	apiKeysUrl: 'https://app.gauzy.ai',

	/**
	 * Not implemented yet — Gauzy AI chat routing is a planned integration.
	 *
	 * @param _modelId Ignored.
	 * @param _credentials Ignored.
	 * @throws Always throws until chat requests can be proxied to Gauzy AI.
	 */
	async createModel(_modelId: string, _credentials: IAiProviderCredentials): Promise<never> {
		throw new Error(
			'Chat via Gauzy AI is not implemented yet — configure another provider. See @gauzy/plugin-ai-provider-gauzy-ai README.'
		);
	}
};
