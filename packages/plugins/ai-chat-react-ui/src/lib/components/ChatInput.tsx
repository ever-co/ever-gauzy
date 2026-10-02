import { type CSSProperties, type KeyboardEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { chatTheme } from '../chat-theme';
import { type ChatTranslate, passthroughChatTranslate } from '../use-chat-translate';

/** Send-button diameter. The action row is deliberately small — the message is the subject. */
const SEND_SIZE = 26;
/** The quiet tools sit a step below the primary action. */
const TOOL_SIZE = 24;
/** Line box of one line of message text. */
const LINE_HEIGHT = 20;
/** A single empty line — the composer opens one line tall and grows from there. */
const MIN_TEXTAREA_HEIGHT = LINE_HEIGHT;
/** Auto-grow ceiling (~6 lines) before the textarea starts scrolling. */
const MAX_TEXTAREA_HEIGHT = 120;

/**
 * What the dictation control is doing.
 *
 * `transcribing` is a distinct state rather than a flag on `recording`: the microphone is already
 * released by then, so the timer must stop and the panel must stop implying it is still listening.
 */
type DictationState = 'idle' | 'recording' | 'transcribing';

/**
 * A failed transcription, with the server's machine-readable reason.
 *
 * `POST /api/ai-chat/transcribe` answers 503 with `{ message, code, settingsPath }` where `code`
 * is an `AiSpeechErrorCode` (`AI_SPEECH_NOT_CONFIGURED` / `AI_SPEECH_KEY_REJECTED` /
 * `AI_SPEECH_FAILED`). The panel's `onTranscribe` throws this so the input can render a
 * translated, actionable message with a link to the AI Providers page; a plain `Error` (network,
 * old server) keeps the message-only path.
 */
export class DictationError extends Error {
	override readonly name = 'DictationError';
	/** `AiSpeechErrorCode` string, when the server sent one. */
	readonly code?: string;
	/** Where the problem is fixed (`/pages/settings/ai`), when the server sent it. */
	readonly settingsPath?: string;
	/** HTTP status of the failed response. */
	readonly status?: number;

	constructor(message: string, details: { code?: string; settingsPath?: string; status?: number } = {}) {
		super(message);
		Object.setPrototypeOf(this, new.target.prototype);
		this.code = details.code;
		this.settingsPath = details.settingsPath;
		this.status = details.status;
	}
}

/** What the dictation error block renders: a translated line, and optionally a settings action. */
interface DictationErrorView {
	message: string;
	/** Present when the fix lives on the AI Providers page AND this user may open it. */
	settingsPath?: string;
}

/** Codes the server sends for dictation failures (mirrors `AiSpeechErrorCode` in @gauzy/contracts). */
const SPEECH_NOT_CONFIGURED = 'AI_SPEECH_NOT_CONFIGURED';
const SPEECH_KEY_REJECTED = 'AI_SPEECH_KEY_REJECTED';
/** Fallback path when the server sent a code but no path (older server build). */
const DEFAULT_AI_SETTINGS_PATH = '/pages/settings/ai';

export interface ChatInputProps {
	value: string;
	/** True while a response is being generated (submit disabled, stop shown). */
	isBusy: boolean;
	/** `t(key, fallback)` from the panel — see `useChatTranslate`. */
	translate?: ChatTranslate;
	onChange: (value: string) => void;
	/**
	 * Send the message. Dictation passes the transcript EXPLICITLY, because `onChange` is
	 * asynchronous and the parent would otherwise submit its pre-dictation state.
	 */
	onSubmit: (text?: string) => void;
	onStop: () => void;
	/** Called when the user presses Escape (collapse the sidebar). */
	onEscape?: () => void;
	/**
	 * Send recorded audio for transcription and resolve with the text.
	 *
	 * The microphone button is hidden entirely when this is absent, rather than shown and then
	 * failing on click: a control that cannot work should not be offered.
	 */
	onTranscribe?: (audio: Blob) => Promise<string>;
	/**
	 * Open the AI Providers settings page (`settingsPath`, default `/pages/settings/ai`).
	 *
	 * Supplied ONLY when the user may actually go there (`AI_CHAT_SETTINGS`): with it, a dictation
	 * failure caused by configuration shows an "Open AI Providers" action; without it, the message
	 * tells the user to ask an administrator. A link that bounces to the settings index is worse
	 * than no link.
	 */
	onOpenAiSettings?: (settingsPath?: string) => void;
	/**
	 * Upload a file the user picked and attach it to this conversation.
	 *
	 * Absent ⇒ the paperclip stays the inert "coming soon" affordance it has always been. Same
	 * rule as `onTranscribe`: a control that cannot work is never offered as if it could.
	 */
	onAttachFile?: (file: File) => Promise<void>;
	/** Open the "attach from Documents" picker. Absent ⇒ the library button stays inert. */
	onAttachFromDocuments?: () => void;
	/** True while an attachment upload is in flight (both attach controls are disabled). */
	isAttaching?: boolean;
	/**
	 * The staged attachments, rendered INSIDE the composer above the field — where Claude puts
	 * them — so they read as part of the message they will be sent with.
	 */
	attachmentsSlot?: ReactNode;
	/**
	 * Identifies what the input is composing FOR — the active conversation.
	 *
	 * A take that outlives its conversation must not be delivered: switching chats while speaking, or
	 * while the transcript is still in flight, would otherwise drop the words into whichever
	 * conversation happens to be open when they arrive.
	 */
	composingFor?: string;
}

/** `0:07`, `1:23` — mm:ss, which is all a dictation take ever needs. */
function formatElapsed(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * Bars in the live level meter — the newest level enters on the right. Enough to span the widest
 * docked panel; on a narrower one the oldest bars are simply clipped on the left.
 */
const LEVEL_BARS = 64;
/** How often the meter samples the microphone. Slower than a frame, so the bars read as speech. */
const LEVEL_SAMPLE_MS = 70;

/**
 * Live microphone level meter for the recording strip.
 *
 * Reads the take's own stream through an `AnalyserNode` and scrolls a short history of loudness
 * across the bars, so the user can see the microphone is actually hearing them. Bars are moved by
 * writing `transform` directly: a React render per sample would re-render the whole composer 14
 * times a second. Without Web Audio (or if it fails) the bars simply rest at their floor.
 */
function LevelMeter({ stream, color }: { stream: MediaStream | null; color: string }) {
	const barsRef = useRef<(HTMLSpanElement | null)[]>([]);

	useEffect(() => {
		if (!stream || typeof window === 'undefined') return;
		const AudioContextCtor =
			window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!AudioContextCtor) return;

		let context: AudioContext | undefined;
		let source: MediaStreamAudioSourceNode;
		let analyser: AnalyserNode;
		try {
			context = new AudioContextCtor();
			source = context.createMediaStreamSource(stream);
			analyser = context.createAnalyser();
			analyser.fftSize = 512;
			source.connect(analyser);
		} catch {
			// Do not leave a half-built context holding audio resources.
			void context?.close().catch(() => undefined);
			return;
		}
		const liveContext = context;
		// Created after the permission prompt resolved, so some browsers start it suspended.
		void liveContext.resume().catch(() => undefined);

		const samples = new Uint8Array(analyser.fftSize);
		const levels = new Array<number>(LEVEL_BARS).fill(0);
		let frame = 0;
		let last = 0;
		const tick = (now: number) => {
			frame = requestAnimationFrame(tick);
			if (now - last < LEVEL_SAMPLE_MS) return;
			last = now;
			analyser.getByteTimeDomainData(samples);
			let sum = 0;
			for (let i = 0; i < samples.length; i++) {
				const centred = (samples[i] - 128) / 128;
				sum += centred * centred;
			}
			// RMS of normal speech sits around 0.05–0.2; scale it so a spoken word fills the bar.
			const level = Math.min(1, Math.sqrt(sum / samples.length) * 5);
			levels.shift();
			levels.push(level);
			for (let i = 0; i < LEVEL_BARS; i++) {
				const bar = barsRef.current[i];
				if (bar) bar.style.transform = `scaleY(${0.18 + levels[i] * 0.82})`;
			}
		};
		frame = requestAnimationFrame(tick);

		return () => {
			cancelAnimationFrame(frame);
			try {
				source.disconnect();
			} catch {
				// Already disconnected.
			}
			void liveContext.close().catch(() => undefined);
		};
	}, [stream]);

	return (
		<span
			aria-hidden="true"
			style={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'flex-end',
				gap: 2,
				height: 16,
				flex: 1,
				minWidth: 0,
				overflow: 'hidden'
			}}
		>
			{Array.from({ length: LEVEL_BARS }, (_, index) => (
				<span
					key={index}
					ref={(element) => {
						barsRef.current[index] = element;
					}}
					style={{
						width: 2,
						height: '100%',
						flexShrink: 0,
						borderRadius: 1,
						backgroundColor: color,
						transform: 'scaleY(0.18)',
						transition: `transform ${LEVEL_SAMPLE_MS}ms linear`
					}}
				/>
			))}
		</span>
	);
}

/**
 * The recorder container format.
 *
 * Chrome and Firefox produce WebM/Opus; Safari has no WebM encoder and produces MP4/AAC. Asking for
 * an unsupported type throws, so the first supported one wins and the browser's own default is the
 * last resort. The server is told what it received via the blob's own MIME type.
 */
function pickRecorderMimeType(): string | undefined {
	if (typeof MediaRecorder === 'undefined') return undefined;
	const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
	return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

/**
 * ChatInput
 *
 * Compact input area for the inline sidebar chat. Features:
 * - Auto-resizing textarea (up to 3 lines)
 * - Enter to send, Shift+Enter for newline, Escape to collapse
 * - Send / Stop button depending on generation state
 * - Attach, library and dictation controls on the leading edge
 *
 * Controlled component — `useChat` from @ai-sdk/react v4 (AI SDK 7)
 * does not manage input state, so the parent owns `value`.
 */
export function ChatInput({
	value,
	isBusy,
	translate: t = passthroughChatTranslate,
	onChange,
	onSubmit,
	onStop,
	onEscape,
	onTranscribe,
	onOpenAiSettings,
	onAttachFile,
	onAttachFromDocuments,
	isAttaching = false,
	attachmentsSlot,
	composingFor
}: ChatInputProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [isFocused, setIsFocused] = useState(false);

	const [dictation, setDictation] = useState<DictationState>('idle');
	const [elapsed, setElapsed] = useState(0);
	const [autoSend, setAutoSend] = useState(false);
	/** The take's microphone stream, for the level meter. Null whenever no take holds the mic. */
	const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
	const [dictationError, setDictationError] = useState<DictationErrorView | null>(null);
	/** Latest settings opener, for the recorder's callbacks (attached once, at take start). */
	const onOpenAiSettingsRef = useRef(onOpenAiSettings);
	onOpenAiSettingsRef.current = onOpenAiSettings;

	/**
	 * Turn a transcription failure into what the error block shows.
	 *
	 * Per server code: "not configured" and "key rejected" name the fix and — when this user may
	 * open it — carry the settings link; a plain failure relays the server's own message, which
	 * already says what the provider reported. Anything that is not a {@link DictationError} keeps
	 * the generic fallback.
	 */
	const describeDictationError = useCallback(
		(error: unknown): DictationErrorView => {
			if (!(error instanceof DictationError)) {
				return {
					message:
						error instanceof Error && error.message
							? error.message
							: t('AI_ASSISTANT.DICTATION_FAILED', 'Could not transcribe the recording.')
				};
			}
			const canOpen = typeof onOpenAiSettingsRef.current === 'function';
			const settingsPath = error.settingsPath || DEFAULT_AI_SETTINGS_PATH;
			if (error.code === SPEECH_NOT_CONFIGURED) {
				return canOpen
					? {
							message: t(
								'AI_ASSISTANT.DICTATION_NOT_CONFIGURED',
								'Dictation needs a voice provider. Add one on the AI Providers settings page.'
							),
							settingsPath
						}
					: {
							message: t(
								'AI_ASSISTANT.DICTATION_ASK_ADMIN',
								'Dictation needs a voice provider — ask an administrator to add one in Settings → AI Providers.'
							)
						};
			}
			if (error.code === SPEECH_KEY_REJECTED) {
				return canOpen
					? {
							message: t(
								'AI_ASSISTANT.DICTATION_KEY_REJECTED',
								'The voice provider rejected its API key. Update it on the AI Providers settings page.'
							),
							settingsPath
						}
					: {
							message: t(
								'AI_ASSISTANT.DICTATION_KEY_REJECTED_ASK_ADMIN',
								'The voice provider rejected its API key — ask an administrator to update it in Settings → AI Providers.'
							)
						};
			}
			return { message: error.message || t('AI_ASSISTANT.DICTATION_FAILED', 'Could not transcribe the recording.') };
		},
		[t]
	);

	const recorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<BlobPart[]>([]);
	/**
	 * The live input text, for the recorder's callbacks.
	 *
	 * `recorder.onstop` is attached when the take STARTS, so it closes over the value from that
	 * moment. The field stays editable throughout, so reading the closed-over copy would overwrite
	 * anything typed while speaking.
	 */
	const valueRef = useRef(value);
	valueRef.current = value;
	/**
	 * Identifies the current take. Bumped whenever one is abandoned — Cancel, or the panel closing.
	 *
	 * Stopping the tracks is not enough on its own: `onstop` still fires, a `getUserMedia` already
	 * in flight still resolves, and a transcription already posted still returns. Each of those
	 * checks this counter and drops out if it has moved, so a closed panel cannot transcribe, submit,
	 * or leave a second recorder holding the microphone.
	 */
	const sessionRef = useRef(0);
	/** Guards the `await getUserMedia` window, where `dictation` is still 'idle'. */
	const startingRef = useRef(false);
	/**
	 * Set by Cancel so the `stop` handler discards instead of transcribing.
	 *
	 * A ref, not state: `stop` fires from the recorder's own event and would otherwise read the
	 * value captured when the handler was attached.
	 */
	const cancelledRef = useRef(false);
	/** Latest auto-send choice, for the same reason — the checkbox can change mid-take. */
	const autoSendRef = useRef(false);
	autoSendRef.current = autoSend;
	/**
	 * The rest of the props the recorder's callbacks need, for the same reason again.
	 *
	 * `recorder.onstop` is attached once, when the take starts. Reading `isBusy` or `onSubmit` from
	 * that closure evaluates the auto-send guard against whatever was true a minute ago — refusing to
	 * send because a since-finished response was streaming, or sending into one that has since begun.
	 */
	const isBusyRef = useRef(isBusy);
	isBusyRef.current = isBusy;
	const onSubmitRef = useRef(onSubmit);
	onSubmitRef.current = onSubmit;
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;
	const onTranscribeRef = useRef(onTranscribe);
	onTranscribeRef.current = onTranscribe;

	// Auto-resize textarea. The floor is one line box: the field sits above its own action row,
	// so it never has to match the height of anything beside it.
	useEffect(() => {
		const el = textareaRef.current;
		if (el) {
			el.style.height = 'auto';
			el.style.height = `${Math.min(Math.max(el.scrollHeight, MIN_TEXTAREA_HEIGHT), MAX_TEXTAREA_HEIGHT)}px`;
		}
	}, [value]);

	// Tick the take timer. Owned by the state, so it cannot outlive a recording.
	useEffect(() => {
		if (dictation !== 'recording') return;
		const id = setInterval(() => setElapsed((s) => s + 1), 1000);
		return () => clearInterval(id);
	}, [dictation]);

	/** Release the microphone. Leaving tracks live keeps the browser's recording indicator on. */
	const releaseRecorder = useCallback(() => {
		recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
		recorderRef.current = null;
		setLiveStream(null);
	}, []);

	// A panel unmounted mid-take (sidebar collapsed, route change) must not hold the microphone, and
	// must not go on to transcribe or send what it captured. Invalidating the session is what stops
	// the in-flight callbacks; releasing the recorder only stops the hardware.
	useEffect(
		() => () => {
			sessionRef.current += 1;
			cancelledRef.current = true;
			try {
				recorderRef.current?.stop();
			} catch {
				// Already inactive — nothing to stop.
			}
			releaseRecorder();
		},
		[releaseRecorder]
	);

	const startDictation = useCallback(async () => {
		// `dictation` is still 'idle' while the permission prompt is up, so it cannot guard this on
		// its own: a second click during the prompt would start a second recorder sharing `chunksRef`,
		// and only the last one would ever be released.
		if (!onTranscribe || dictation !== 'idle' || startingRef.current) return;
		startingRef.current = true;
		setDictationError(null);

		const session = sessionRef.current;
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			// The panel may have closed while the prompt was up. Take the microphone straight back.
			if (session !== sessionRef.current) {
				stream.getTracks().forEach((track) => track.stop());
				return;
			}

			const mimeType = pickRecorderMimeType();
			let recorder: MediaRecorder;
			try {
				recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
			} catch (constructionError) {
				// `releaseRecorder` reads `recorderRef.current`, which is still null here — so the
				// stream just acquired would never be stopped and the microphone would stay live for
				// the life of the tab. Stop what we are actually holding.
				stream.getTracks().forEach((track) => track.stop());
				throw constructionError;
			}
			chunksRef.current = [];
			cancelledRef.current = false;

			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) chunksRef.current.push(event.data);
			};
			recorder.onstop = () => {
				const audio = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
				chunksRef.current = [];
				releaseRecorder();
				if (cancelledRef.current || session !== sessionRef.current || audio.size === 0) {
					setDictation('idle');
					return;
				}
				setDictation('transcribing');
				onTranscribe(audio)
					.then((text) => {
						// Transcription outlives a panel the user closed while waiting.
						if (session !== sessionRef.current) return;
						const spoken = text.trim();
						if (!spoken) return;
						// Read the CURRENT draft, not the one captured when recording began — the field
						// stays editable while speaking. APPENDED, because dictation is an input method
						// rather than a replacement for one.
						const draft = valueRef.current.trim();
						const next = draft ? `${draft} ${spoken}` : spoken;
						onChangeRef.current(next);
						// The transcript goes to the parent EXPLICITLY: `onChange` has not been applied
						// yet, so submitting without it would send the pre-dictation text.
						if (autoSendRef.current && !isBusyRef.current) onSubmitRef.current(next);
					})
					.catch((error: unknown) => {
						if (session !== sessionRef.current) return;
						setDictationError(describeDictationError(error));
					})
					.finally(() => {
						if (session === sessionRef.current) setDictation('idle');
					});
			};

			recorderRef.current = recorder;
			// A time slice, so `ondataavailable` fires during the take: without it a tab suspended or
			// closed mid-recording loses everything buffered.
			recorder.start(1000);
			setElapsed(0);
			setLiveStream(stream);
			setDictation('recording');
		} catch (error: unknown) {
			releaseRecorder();
			setDictation('idle');
			setDictationError({
				message:
					error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')
						? t('AI_ASSISTANT.MIC_DENIED', 'Microphone access was denied.')
						: t('AI_ASSISTANT.MIC_UNAVAILABLE', 'No microphone is available.')
			});
		} finally {
			startingRef.current = false;
		}
		// Deliberately narrow: everything the async callbacks need is read through a ref, so the
		// identity of this callback does not have to change when a prop does.
	}, [onTranscribe, dictation, releaseRecorder, t, describeDictationError]);

	// A conversation switch abandons the take, for the same reason a collapse does: the words were
	// meant for the chat that is no longer open.
	useEffect(() => {
		if (dictation === 'idle') return;
		cancelledRef.current = true;
		sessionRef.current += 1;
		try {
			recorderRef.current?.stop();
		} catch {
			// Already inactive.
		}
		releaseRecorder();
		setDictation('idle');
		// Deliberately keyed ONLY on the conversation: including `dictation` would abandon every take
		// the moment it started.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [composingFor]);

	// Collapsing the chat does NOT unmount this panel — the sidebar is hidden with `display: none` —
	// so the unmount teardown never runs and a take would keep recording with its Cancel and Done
	// buttons off screen. Losing visibility is treated as abandoning the take.
	useEffect(() => {
		if (dictation !== 'recording') return;
		const root = containerRef.current;
		if (!root || typeof IntersectionObserver === 'undefined') return;
		const observer = new IntersectionObserver((entries) => {
			// `display: none` yields a zero-area rect, which reads as not intersecting.
			if (entries.some((entry) => !entry.isIntersecting)) {
				cancelledRef.current = true;
				sessionRef.current += 1;
				try {
					recorderRef.current?.stop();
				} catch {
					// Already inactive.
				}
				releaseRecorder();
				setDictation('idle');
			}
		});
		observer.observe(root);
		return () => observer.disconnect();
	}, [dictation, releaseRecorder]);

	/**
	 * Return focus to the composer.
	 *
	 * Done and Cancel remove the button that was focused, and the mic button is disabled in the same
	 * instant, so focus would otherwise fall to `<body>` with nowhere sensible to resume.
	 */
	const restoreFocus = useCallback(() => {
		textareaRef.current?.focus();
	}, []);

	const finishDictation = useCallback(() => {
		if (dictation !== 'recording') return;
		cancelledRef.current = false;
		recorderRef.current?.stop();
		restoreFocus();
	}, [dictation, restoreFocus]);

	const cancelDictation = useCallback(() => {
		if (dictation !== 'recording') return;
		cancelledRef.current = true;
		// Invalidate too, so a transcription already posted for this take is discarded on arrival.
		sessionRef.current += 1;
		recorderRef.current?.stop();
		restoreFocus();
	}, [dictation, restoreFocus]);

	function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
		// Ignore key events fired while an IME composition is active (e.g.
		// confirming Japanese/Chinese candidates with Enter must not submit).
		if (e.nativeEvent.isComposing || e.key === 'Process') return;
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			if (value.trim() && !isBusy) {
				onSubmit();
			}
		} else if (e.key === 'Escape') {
			e.preventDefault();
			// Escape belongs to the recording first: abandoning a take should not also close the chat.
			if (dictation === 'recording') cancelDictation();
			else onEscape?.();
		}
	}

	const containerStyle: CSSProperties = {
		borderTop: `1px solid ${chatTheme.border}`,
		padding: '10px 12px 12px',
		flexShrink: 0
	};

	// The message is written across the FULL width and the controls tuck underneath it, rather
	// than the field being squeezed between two clusters of buttons on one row.
	const formStyle: CSSProperties = {
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'stretch',
		gap: 6,
		backgroundColor: chatTheme.inputBg,
		borderRadius: chatTheme.inputRadius,
		border: `1px solid ${isFocused ? chatTheme.inputFocusBorder : chatTheme.inputBorder}`,
		// A visible focus ring is what tells the user the composer is live; the border
		// alone moved by one hairline and read as no change at all.
		boxShadow: isFocused ? chatTheme.inputFocusRing : 'none',
		padding: '8px 8px 6px',
		transition: `border-color ${chatTheme.transitionSpeed} ease, box-shadow ${chatTheme.transitionSpeed} ease`
	};

	/** The action row under the message: quiet tools left, Send pushed to the end. */
	const toolRowStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		gap: 2,
		minWidth: 0
	};

	const textareaStyle: CSSProperties = {
		width: '100%',
		border: 'none',
		outline: 'none',
		backgroundColor: 'transparent',
		color: chatTheme.inputText,
		fontSize: chatTheme.fontSizeInput,
		fontFamily: chatTheme.fontFamily,
		lineHeight: `${LINE_HEIGHT}px`,
		letterSpacing: '0.01em',
		resize: 'none',
		// Nothing sits beside the field any more, so it needs no padding of its own to line up
		// against: the form's padding is the whole inset, and the box is exactly its text.
		minHeight: MIN_TEXTAREA_HEIGHT,
		maxHeight: MAX_TEXTAREA_HEIGHT,
		padding: '0 2px',
		boxSizing: 'border-box',
		margin: 0,
		minWidth: 0,
		// No stray scrollbars/borders/native chrome inside the field — the
		// surrounding form provides the visual box; scroll vertically only
		// once the 3-line auto-grow limit is reached.
		overflowX: 'hidden',
		overflowY: 'auto',
		boxShadow: 'none',
		appearance: 'none',
		WebkitAppearance: 'none'
	};

	const canSend = Boolean(value.trim());

	const buttonStyle: CSSProperties = {
		width: SEND_SIZE,
		height: SEND_SIZE,
		borderRadius: '50%',
		backgroundColor: isBusy ? chatTheme.red : chatTheme.accent,
		color: '#ffffff',
		border: 'none',
		cursor: 'pointer',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		flexShrink: 0,
		// Anchored to the end of the action row, away from the quiet tools.
		marginLeft: 'auto',
		padding: 0,
		boxShadow: !isBusy && !canSend ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.18)',
		opacity: !isBusy && !canSend ? 0.35 : 1,
		outline: 'none'
	};

	/** The quiet leading-edge tools: attach, library, dictate. */
	const toolButtonStyle = (active = false, enabled = true): CSSProperties => ({
		width: TOOL_SIZE,
		height: TOOL_SIZE,
		borderRadius: 6,
		backgroundColor: active ? chatTheme.redSoft : 'transparent',
		color: active ? chatTheme.red : chatTheme.textMuted,
		border: 'none',
		cursor: enabled ? 'pointer' : 'not-allowed',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		flexShrink: 0,
		opacity: enabled ? 1 : 0.45,
		padding: 0,
		outline: 'none'
	});

	/**
	 * The action row while recording: the take replaces the tools IN the composer — a waveform
	 * across the row, the timer, then Cancel and Done as round buttons at the trailing edge.
	 */
	const recordingRowStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		gap: 8,
		minWidth: 0,
		minHeight: SEND_SIZE,
		paddingLeft: 2,
		fontSize: chatTheme.fontSizeSmall,
		lineHeight: 1,
		color: chatTheme.inputText
	};

	/** Round Cancel / Done, the same diameter as Send so the trailing edge does not jump. */
	const roundButtonStyle = (filled: boolean): CSSProperties => ({
		width: SEND_SIZE,
		height: SEND_SIZE,
		flexShrink: 0,
		borderRadius: '50%',
		border: filled ? 'none' : `1px solid ${chatTheme.inputBorder}`,
		backgroundColor: filled ? chatTheme.accent : 'transparent',
		color: filled ? '#ffffff' : chatTheme.textSecondary,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		padding: 0,
		cursor: 'pointer',
		outline: 'none'
	});

	/** Announced to screen readers when a take starts and ends — never the ticking timer. */
	const visuallyHiddenStyle: CSSProperties = {
		position: 'absolute',
		width: 1,
		height: 1,
		margin: -1,
		padding: 0,
		overflow: 'hidden',
		clip: 'rect(0 0 0 0)',
		whiteSpace: 'nowrap',
		border: 0
	};

	/** Auto-send as a switch: a bare checkbox picked up the host theme's form styles. */
	const switchTrackStyle: CSSProperties = {
		position: 'relative',
		width: 22,
		height: 12,
		flexShrink: 0,
		borderRadius: 6,
		backgroundColor: autoSend ? chatTheme.accent : 'color-mix(in srgb, currentColor 22%, transparent)',
		transition: `background-color ${chatTheme.transitionSpeed} ease`
	};

	const switchKnobStyle: CSSProperties = {
		position: 'absolute',
		top: 2,
		left: 2,
		width: 8,
		height: 8,
		borderRadius: '50%',
		backgroundColor: '#ffffff',
		transform: autoSend ? 'translateX(10px)' : 'none',
		transition: `transform ${chatTheme.transitionSpeed} ease`
	};

	const isRecording = dictation === 'recording';
	const isTranscribing = dictation === 'transcribing';

	return (
		<div ref={containerRef} style={containerStyle}>
			{/* Recording happens IN the composer's action row (below), so starting a take never
			    displaces the message the user may already have typed. */}
			{/* The one live region: it changes only when a take starts or stops, so it is announced
			    once. The timer is deliberately outside it — a ticking clock inside a live region
			    re-announces every second for the length of the take. */}
			<span role="status" style={visuallyHiddenStyle}>
				{isRecording
					? t('AI_ASSISTANT.RECORDING', 'Recording')
					: isTranscribing
						? t('AI_ASSISTANT.TRANSCRIBING', 'Transcribing…')
						: ''}
			</span>

			{dictationError && (
				<div
					role="alert"
					style={{
						display: 'flex',
						alignItems: 'flex-start',
						gap: 6,
						marginBottom: 8,
						padding: '6px 9px',
						borderRadius: chatTheme.controlRadius,
						backgroundColor: 'rgba(255, 61, 113, 0.1)',
						fontSize: chatTheme.fontSizeSmall,
						lineHeight: 1.5,
						color: chatTheme.red
					}}
				>
					<span style={{ flex: 1 }}>
						{dictationError.message}
						{/* The fix lives on the AI Providers page and this user may open it: say so with a
						    link rather than a sentence that names a page they then have to find. Only
						    rendered when the panel supplied the opener (i.e. the user has AI_CHAT_SETTINGS). */}
						{dictationError.settingsPath && onOpenAiSettings && (
							<>
								{' '}
								<button
									type="button"
									onClick={() => {
										onOpenAiSettings(dictationError.settingsPath);
										setDictationError(null);
									}}
									style={{
										border: 'none',
										background: 'transparent',
										color: chatTheme.accent,
										cursor: 'pointer',
										padding: 0,
										font: 'inherit',
										textDecoration: 'underline'
									}}
								>
									{t('AI_ASSISTANT.DICTATION_OPEN_SETTINGS', 'Open AI Providers')}
								</button>
							</>
						)}
					</span>
					{/* Otherwise it sits above the composer until the next take, which the user may
					    reasonably not want to start. */}
					<button
						type="button"
						onClick={() => setDictationError(null)}
						style={{
							border: 'none',
							background: 'transparent',
							color: 'inherit',
							cursor: 'pointer',
							padding: 0,
							lineHeight: 1
						}}
						title={t('AI_ASSISTANT.DISMISS', 'Dismiss')}
						aria-label={t('AI_ASSISTANT.DISMISS', 'Dismiss')}
					>
						×
					</button>
				</div>
			)}

			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (value.trim() && !isBusy) onSubmit();
				}}
				style={formStyle}
			>
				{/* Attach and library become LIVE controls once the panel supplies their handlers;
				    without them they stay the inert "coming soon" affordance they have always been.
				    Same rule as dictation: a control that cannot work is never offered as if it could. */}
				{/* `aria-disabled`, NOT the native `disabled`, in the inert case: that removes the
				    control from the tab order and suppresses its tooltip, so the "coming soon" hint the
				    comment calls discoverable would be reachable by neither keyboard nor hover. This
				    keeps it focusable and announced, and the no-op click keeps it inert. */}
				{onAttachFile && (
					<input
						ref={fileInputRef}
						type="file"
						style={{ display: 'none' }}
						onChange={(event) => {
							const file = event.target.files?.[0];
							// Reset first: picking the SAME file twice fires no change event
							// otherwise, so a failed attachment could never be retried.
							event.target.value = '';
							if (file) void onAttachFile(file);
						}}
					/>
				)}

				{attachmentsSlot}

				<textarea
					ref={textareaRef}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					onKeyDown={handleKeyDown}
					onFocus={() => setIsFocused(true)}
					onBlur={() => setIsFocused(false)}
					placeholder={t('AI_ASSISTANT.PLACEHOLDER', 'Type a message…')}
					rows={1}
					className="gz-ai-chat-textarea"
					style={textareaStyle}
					aria-label={t('AI_ASSISTANT.PLACEHOLDER', 'Type a message…')}
				/>

				{/* While a take is recording, the action row BECOMES the recorder: waveform, timer,
				    auto-send, then Cancel and Done. The tools come back the moment the take ends.
				    Escape anywhere in the row abandons the take, as it does from the field. */}
				{isRecording ? (
					<div
						role="group"
						aria-label={t('AI_ASSISTANT.RECORDING', 'Recording')}
						style={recordingRowStyle}
						onKeyDown={(event) => {
							if (event.key === 'Escape') {
								event.preventDefault();
								cancelDictation();
							}
						}}
					>
						<LevelMeter stream={liveStream} color={chatTheme.textSecondary} />

						<span
							style={{
								flexShrink: 0,
								minWidth: 28,
								textAlign: 'right',
								color: chatTheme.textSecondary,
								fontVariantNumeric: 'tabular-nums'
							}}
						>
							{formatElapsed(elapsed)}
						</span>

						<button
							type="button"
							role="switch"
							aria-checked={autoSend}
							onClick={() => setAutoSend((current) => !current)}
							className="gz-ai-chat-rec-switch"
							title={t('AI_ASSISTANT.AUTO_SEND', 'Auto-send')}
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: 6,
								flexShrink: 0,
								height: 24,
								padding: '0 5px',
								border: 'none',
								borderRadius: 6,
								backgroundColor: 'transparent',
								color: chatTheme.textSecondary,
								fontSize: chatTheme.fontSizeSmall,
								fontFamily: chatTheme.fontFamily,
								lineHeight: 1,
								cursor: 'pointer',
								outline: 'none'
							}}
						>
							<span aria-hidden="true" style={switchTrackStyle}>
								<span style={switchKnobStyle} />
							</span>
							<span className="gz-ai-chat-rec-switch-label">{t('AI_ASSISTANT.AUTO_SEND', 'Auto-send')}</span>
						</button>

						<button
							type="button"
							onClick={cancelDictation}
							className="gz-ai-chat-rec-cancel"
							style={roundButtonStyle(false)}
							title={t('AI_ASSISTANT.CANCEL', 'Cancel')}
							aria-label={t('AI_ASSISTANT.CANCEL', 'Cancel')}
						>
							<svg
								width="12"
								height="12"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2.4"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
							>
								<path d="M18 6 6 18" />
								<path d="m6 6 12 12" />
							</svg>
						</button>

						<button
							type="button"
							onClick={finishDictation}
							// Focus lands here when the take starts — the mic button that had it is gone.
							autoFocus
							className="gz-ai-chat-rec-done"
							style={roundButtonStyle(true)}
							title={t('AI_ASSISTANT.DONE', 'Done')}
							aria-label={t('AI_ASSISTANT.DONE', 'Done')}
						>
							<svg
								width="13"
								height="13"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2.6"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
							>
								<path d="M20 6 9 17l-5-5" />
							</svg>
						</button>

						{/* A reply still streaming keeps its Stop control during a take. */}
						{isBusy && (
							<button
								type="button"
								onClick={onStop}
								className="gz-ai-chat-send-btn"
								style={{ ...buttonStyle, marginLeft: 0 }}
								title={t('AI_ASSISTANT.STOP', 'Stop generating')}
								aria-label={t('AI_ASSISTANT.STOP', 'Stop generating')}
							>
								<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
									<rect x="6" y="6" width="12" height="12" rx="2" />
								</svg>
							</button>
						)}
					</div>
				) : (
				/* Action row. Small on purpose: attach, library and dictation are occasional,
				   the message above them is the subject of this panel. */
				<div style={toolRowStyle}>
					<button
						type="button"
						{...(onAttachFile && !isAttaching
							? { onClick: () => fileInputRef.current?.click() }
							: { 'aria-disabled': true as const, onClick: (e: { preventDefault: () => void }) => e.preventDefault() })}
						className="gz-ai-chat-tool-btn"
						style={toolButtonStyle(false, Boolean(onAttachFile) && !isAttaching)}
						title={
							onAttachFile
								? t('AI_ASSISTANT.ATTACH', 'Attach a file')
								: t('AI_ASSISTANT.ATTACH_SOON', 'Attach files or folders (coming soon)')
						}
						aria-label={
							onAttachFile
								? t('AI_ASSISTANT.ATTACH', 'Attach a file')
								: t('AI_ASSISTANT.ATTACH_SOON', 'Attach files or folders (coming soon)')
						}
					>
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
						</svg>
					</button>

					<button
						type="button"
						{...(onAttachFromDocuments && !isAttaching
							? { onClick: () => onAttachFromDocuments() }
							: { 'aria-disabled': true as const, onClick: (e: { preventDefault: () => void }) => e.preventDefault() })}
						className="gz-ai-chat-tool-btn"
						style={toolButtonStyle(false, Boolean(onAttachFromDocuments) && !isAttaching)}
						title={
							onAttachFromDocuments
								? t('AI_ASSISTANT.ATTACH_FROM_DOCUMENTS', 'Attach from Documents')
								: t('AI_ASSISTANT.LIBRARY_SOON', 'Choose from the file library (coming soon)')
						}
						aria-label={
							onAttachFromDocuments
								? t('AI_ASSISTANT.ATTACH_FROM_DOCUMENTS', 'Attach from Documents')
								: t('AI_ASSISTANT.LIBRARY_SOON', 'Choose from the file library (coming soon)')
						}
					>
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
							<polyline points="14 2 14 8 20 8" />
							<line x1="8" y1="13" x2="16" y2="13" />
							<line x1="8" y1="17" x2="13" y2="17" />
						</svg>
					</button>

					{onTranscribe && (
						<button
							type="button"
							onClick={isRecording ? finishDictation : startDictation}
							disabled={isTranscribing}
							className="gz-ai-chat-tool-btn"
							// Not dimmed while transcribing: the spinner it shows then is the progress signal.
							style={{ ...toolButtonStyle(isRecording), cursor: isTranscribing ? 'default' : 'pointer' }}
							title={
								isRecording
									? t('AI_ASSISTANT.STOP_DICTATION', 'Stop dictation')
									: t('AI_ASSISTANT.DICTATE', 'Dictate a message')
							}
							aria-label={
								isRecording
									? t('AI_ASSISTANT.STOP_DICTATION', 'Stop dictation')
									: t('AI_ASSISTANT.DICTATE', 'Dictate a message')
							}
							aria-pressed={isRecording}
						>
							{isTranscribing ? (
								<span
									aria-hidden="true"
									className="gz-ai-chat-rec-spinner"
									style={{
										width: 12,
										height: 12,
										boxSizing: 'border-box',
										borderRadius: '50%',
										border: `1.5px solid ${chatTheme.border}`,
										borderTopColor: chatTheme.accent,
										display: 'inline-block'
									}}
								/>
							) : (
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
									<path d="M19 10v2a7 7 0 0 1-14 0v-2" />
									<line x1="12" y1="19" x2="12" y2="23" />
								</svg>
							)}
						</button>
					)}
					{isTranscribing && (
						<span
							aria-hidden="true"
							style={{
								marginLeft: 4,
								fontSize: chatTheme.fontSizeSmall,
								color: chatTheme.textSecondary,
								whiteSpace: 'nowrap'
							}}
						>
							{t('AI_ASSISTANT.TRANSCRIBING', 'Transcribing…')}
						</span>
					)}

					{isBusy ? (
						<button
							type="button"
							onClick={onStop}
							className="gz-ai-chat-send-btn"
							style={buttonStyle}
							title={t('AI_ASSISTANT.STOP', 'Stop generating')}
							aria-label={t('AI_ASSISTANT.STOP', 'Stop generating')}
						>
							<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
								<rect x="6" y="6" width="12" height="12" rx="2" />
							</svg>
						</button>
					) : (
						<button
							type="submit"
							disabled={!canSend}
							className="gz-ai-chat-send-btn"
							style={buttonStyle}
							title={t('AI_ASSISTANT.SEND', 'Send message')}
							aria-label={t('AI_ASSISTANT.SEND', 'Send message')}
						>
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<line x1="22" y1="2" x2="11" y2="13" />
								<polygon points="22 2 15 22 11 13 2 9 22 2" />
							</svg>
						</button>
					)}
				</div>
				)}
			</form>
		</div>
	);
}
