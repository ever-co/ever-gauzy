export { SpeechProviderError, isSpeechProviderError } from './speech-provider-error';
export type { SpeechProviderErrorKind } from './speech-provider-error';
export {
	MAX_ERROR_DETAIL_BYTES,
	TRANSCRIBE_TIMEOUT_MS,
	classifySpeechHttpFailure,
	readBounded,
	redactSecret,
	resolveAudioExtension,
	speechRequest,
	transcribeMultipart,
	transcribeViaOpenAiCompatible,
	trimTrailingSlash
} from './openai-compatible-transcribe';
export type {
	ISpeechRequestArgs,
	ISpeechRequestBase,
	ITranscribeMultipartArgs,
	ITranscribeViaOpenAiCompatibleArgs
} from './openai-compatible-transcribe';
