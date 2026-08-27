import { AiProviderEnum, IAiChatModel } from '@gauzy/contracts';
import {
	IAiChatProviderDefinition,
	IAiProviderCredentials,
	IAiTranscribeOptions,
	transcribeMultipart,
	trimTrailingSlash
} from '@gauzy/plugin-ai-chat';

/** Stable provider id used by the registry, the UI and BYOK credentials. */
const PROVIDER_ID = AiProviderEnum.ELEVENLABS;

/** ElevenLabs' REST API base. */
const DEFAULT_BASE_URL = 'https://api.elevenlabs.io/v1';

/** Speech-to-text models (ElevenLabs Scribe). `scribe_v1` is the default. */
const SPEECH_MODELS: IAiChatModel[] = [
	{ id: 'scribe_v1', label: 'Scribe v1', providerId: PROVIDER_ID },
	{ id: 'scribe_v1_experimental', label: 'Scribe v1 (experimental)', providerId: PROVIDER_ID }
];

/** Speech model used when the tenant has not chosen one. */
const DEFAULT_SPEECH_MODEL = 'scribe_v1';

/**
 * Speech-to-text through ElevenLabs' `POST /v1/speech-to-text`.
 *
 * Multipart with `file` + `model_id` (not `model`), authenticated with the `xi-api-key` header;
 * the transcript comes back as `text`. `language_code` is ISO-639-1/-3 and only sent when the
 * caller supplied a hint (auto-detection otherwise).
 */
const transcribeAudio = async (
	audio: Buffer,
	mimeType: string,
	credentials: IAiProviderCredentials,
	options?: IAiTranscribeOptions
): Promise<string> =>
	transcribeMultipart({
		url: `${trimTrailingSlash(credentials.baseUrl || DEFAULT_BASE_URL)}/speech-to-text`,
		audio,
		mimeType,
		fields: {
			model_id: options?.model || DEFAULT_SPEECH_MODEL,
			language_code: options?.language
		},
		headers: { 'xi-api-key': credentials.apiKey },
		apiKey: credentials.apiKey,
		providerLabel: 'ElevenLabs',
		providerId: PROVIDER_ID
	});

/**
 * ElevenLabs provider definition for the AI chat engine — SPEECH-TO-TEXT ONLY.
 *
 * ElevenLabs has no chat models here, so `chatCapable` is `false` and `createModel` throws (the
 * placeholder pattern): the provider shows in the catalogue as a voice provider, can be the
 * tenant's voice default, and is never selectable for chat.
 */
export const elevenLabsProviderDefinition: IAiChatProviderDefinition = {
	id: PROVIDER_ID,
	label: 'ElevenLabs',
	apiKeyEnvVars: ['ELEVENLABS_API_KEY'],
	baseUrlEnvVar: 'ELEVENLABS_BASE_URL',
	models: [],
	defaultModel: '',
	chatCapable: false,
	transcribe: transcribeAudio,
	speech: { models: SPEECH_MODELS, defaultModel: DEFAULT_SPEECH_MODEL },
	defaultBaseUrl: DEFAULT_BASE_URL,
	order: 120,
	websiteUrl: 'https://elevenlabs.io',
	apiKeysUrl: 'https://elevenlabs.io/app/settings/api-keys',

	/**
	 * Not a chat provider.
	 *
	 * @param _modelId Ignored.
	 * @param _credentials Ignored.
	 * @throws Always — ElevenLabs is used for speech-to-text only.
	 */
	async createModel(_modelId: string, _credentials: IAiProviderCredentials): Promise<never> {
		throw new Error(
			'ElevenLabs is a speech-to-text provider and cannot serve chat — select another provider for chat.'
		);
	}
};
