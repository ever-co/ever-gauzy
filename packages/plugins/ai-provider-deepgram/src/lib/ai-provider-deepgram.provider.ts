import { AiProviderEnum, IAiChatModel } from '@gauzy/contracts';
import {
	IAiChatProviderDefinition,
	IAiProviderCredentials,
	IAiTranscribeOptions,
	speechRequest,
	trimTrailingSlash
} from '@gauzy/plugin-ai-chat';

/** Stable provider id used by the registry, the UI and BYOK credentials. */
const PROVIDER_ID = AiProviderEnum.DEEPGRAM;

/** Deepgram's REST API base. */
const DEFAULT_BASE_URL = 'https://api.deepgram.com/v1';

/**
 * Speech-to-text models (Deepgram Nova). `nova-3` is the current flagship and the default;
 * `nova-2` stays selectable for accounts/languages that still route to it.
 */
const SPEECH_MODELS: IAiChatModel[] = [
	{ id: 'nova-3', label: 'Nova-3', providerId: PROVIDER_ID },
	{ id: 'nova-2', label: 'Nova-2', providerId: PROVIDER_ID }
];

/** Speech model used when the tenant has not chosen one. */
const DEFAULT_SPEECH_MODEL = 'nova-3';

/** Shape of a Deepgram pre-recorded transcription response (the slice read here). */
interface IDeepgramListenResponse {
	results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
}

/**
 * Speech-to-text through Deepgram's pre-recorded endpoint.
 *
 * `POST /v1/listen?model=<model>&smart_format=true` takes the RAW audio bytes as the body with the
 * container in `Content-Type` — not multipart — and authenticates with `Authorization: Token <key>`.
 * `smart_format` adds punctuation and formatting, which is what a dictated chat message wants.
 * The transcript is `results.channels[0].alternatives[0].transcript`.
 */
const transcribeAudio = async (
	audio: Buffer,
	mimeType: string,
	credentials: IAiProviderCredentials,
	options?: IAiTranscribeOptions
): Promise<string> => {
	const params = new URLSearchParams({ model: options?.model || DEFAULT_SPEECH_MODEL, smart_format: 'true' });
	if (options?.language) {
		params.set('language', options.language);
	}
	const base = trimTrailingSlash(credentials.baseUrl || DEFAULT_BASE_URL);
	return speechRequest({
		url: `${base}/listen?${params.toString()}`,
		init: {
			method: 'POST',
			headers: {
				authorization: `Token ${credentials.apiKey}`,
				// The container Deepgram should expect; `audio/webm;codecs=opus` is accepted verbatim.
				'content-type': mimeType || 'audio/webm'
			},
			body: new Uint8Array(audio)
		},
		apiKey: credentials.apiKey,
		providerLabel: 'Deepgram',
		providerId: PROVIDER_ID,
		parse: (body) => (body as IDeepgramListenResponse).results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ''
	});
};

/**
 * Deepgram provider definition for the AI chat engine — SPEECH-TO-TEXT ONLY.
 *
 * Deepgram has no chat models, so `chatCapable` is `false` and `createModel` throws (the same
 * placeholder pattern as the Gauzy AI provider): the provider shows in the catalogue as a voice
 * provider, can be the tenant's voice default, and is never selectable for chat.
 */
export const deepgramProviderDefinition: IAiChatProviderDefinition = {
	id: PROVIDER_ID,
	label: 'Deepgram',
	apiKeyEnvVars: ['DEEPGRAM_API_KEY'],
	baseUrlEnvVar: 'DEEPGRAM_BASE_URL',
	models: [],
	defaultModel: '',
	chatCapable: false,
	transcribe: transcribeAudio,
	speech: { models: SPEECH_MODELS, defaultModel: DEFAULT_SPEECH_MODEL },
	defaultBaseUrl: DEFAULT_BASE_URL,
	order: 110,
	websiteUrl: 'https://deepgram.com',
	apiKeysUrl: 'https://console.deepgram.com/',

	/**
	 * Not a chat provider.
	 *
	 * @param _modelId Ignored.
	 * @param _credentials Ignored.
	 * @throws Always — Deepgram offers speech-to-text only.
	 */
	async createModel(_modelId: string, _credentials: IAiProviderCredentials): Promise<never> {
		throw new Error('Deepgram is a speech-to-text provider and cannot serve chat — select another provider for chat.');
	}
};
