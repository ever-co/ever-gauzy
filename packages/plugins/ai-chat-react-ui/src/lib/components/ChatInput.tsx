import { type CSSProperties, type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { chatTheme } from '../chat-theme';
import { type ChatTranslate, passthroughChatTranslate } from '../use-chat-translate';

/** Button height, and therefore the height of a single-line input row. */
const ROW_HEIGHT = 28;
/** Line box of one line of text at the chat's base size. */
const LINE_HEIGHT = 20;
/** Auto-grow ceiling (~3 lines) before the textarea starts scrolling. */
const MAX_TEXTAREA_HEIGHT = 80;

/**
 * What the dictation control is doing.
 *
 * `transcribing` is a distinct state rather than a flag on `recording`: the microphone is already
 * released by then, so the timer must stop and the panel must stop implying it is still listening.
 */
type DictationState = 'idle' | 'recording' | 'transcribing';

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
	composingFor
}: ChatInputProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [isFocused, setIsFocused] = useState(false);

	const [dictation, setDictation] = useState<DictationState>('idle');
	const [elapsed, setElapsed] = useState(0);
	const [autoSend, setAutoSend] = useState(false);
	const [dictationError, setDictationError] = useState<string | null>(null);

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

	// Auto-resize textarea. The floor is the row height so a single line is vertically centred
	// against the buttons rather than sitting hard against the bottom of the row.
	useEffect(() => {
		const el = textareaRef.current;
		if (el) {
			el.style.height = 'auto';
			el.style.height = `${Math.min(Math.max(el.scrollHeight, ROW_HEIGHT), MAX_TEXTAREA_HEIGHT)}px`;
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
						setDictationError(
							error instanceof Error
								? error.message
								: t('AI_ASSISTANT.DICTATION_FAILED', 'Could not transcribe the recording.')
						);
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
			setDictation('recording');
		} catch (error: unknown) {
			releaseRecorder();
			setDictation('idle');
			setDictationError(
				error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')
					? t('AI_ASSISTANT.MIC_DENIED', 'Microphone access was denied.')
					: t('AI_ASSISTANT.MIC_UNAVAILABLE', 'No microphone is available.')
			);
		} finally {
			startingRef.current = false;
		}
		// Deliberately narrow: everything the async callbacks need is read through a ref, so the
		// identity of this callback does not have to change when a prop does.
	}, [onTranscribe, dictation, releaseRecorder, t]);

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
		padding: '8px 10px',
		flexShrink: 0
	};

	const formStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'flex-end',
		gap: 6,
		backgroundColor: chatTheme.inputBg,
		borderRadius: chatTheme.inputRadius,
		border: `1px solid ${isFocused ? chatTheme.inputFocusBorder : chatTheme.inputBorder}`,
		padding: '6px 8px',
		transition: `border-color ${chatTheme.transitionSpeed} ease`
	};

	const textareaStyle: CSSProperties = {
		flex: 1,
		border: 'none',
		outline: 'none',
		backgroundColor: 'transparent',
		color: chatTheme.inputText,
		fontSize: chatTheme.fontSizeBase,
		fontFamily: chatTheme.fontFamily,
		lineHeight: `${LINE_HEIGHT}px`,
		resize: 'none',
		// A single line occupies the full row height with the text centred inside it: the row is as
		// tall as the buttons beside it, and the leftover space is split evenly above and below.
		// Previously the box was 20px tall and bottom-aligned against 28px buttons, which put every
		// pixel of that difference above the text and none below.
		minHeight: ROW_HEIGHT,
		maxHeight: MAX_TEXTAREA_HEIGHT,
		padding: `${(ROW_HEIGHT - LINE_HEIGHT) / 2}px 0`,
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

	const buttonStyle: CSSProperties = {
		width: ROW_HEIGHT,
		height: ROW_HEIGHT,
		borderRadius: '50%',
		backgroundColor: isBusy ? chatTheme.red : chatTheme.accent,
		color: '#ffffff',
		border: 'none',
		cursor: 'pointer',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		flexShrink: 0,
		transition: `background-color ${chatTheme.transitionSpeed} ease`,
		opacity: !isBusy && !value.trim() ? 0.4 : 1,
		outline: 'none'
	};

	/** The quiet leading-edge tools: attach, library, dictate. */
	const toolButtonStyle = (active = false, enabled = true): CSSProperties => ({
		width: ROW_HEIGHT,
		height: ROW_HEIGHT,
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

	const recordingPanelStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		gap: 10,
		marginBottom: 6,
		padding: '6px 10px',
		borderRadius: chatTheme.inputRadius,
		border: `1px solid ${chatTheme.inputBorder}`,
		backgroundColor: chatTheme.inputBg,
		fontSize: chatTheme.fontSizeSmall,
		color: chatTheme.inputText
	};

	const panelButtonStyle = (primary: boolean): CSSProperties => ({
		border: `1px solid ${primary ? chatTheme.accent : chatTheme.inputBorder}`,
		backgroundColor: 'transparent',
		color: primary ? chatTheme.accent : chatTheme.inputText,
		borderRadius: 6,
		padding: '3px 10px',
		fontSize: chatTheme.fontSizeSmall,
		fontFamily: chatTheme.fontFamily,
		cursor: 'pointer',
		outline: 'none'
	});

	const isRecording = dictation === 'recording';
	const isTranscribing = dictation === 'transcribing';

	return (
		<div ref={containerRef} style={containerStyle}>
			{/* Recording controls sit ABOVE the input, so starting a take never displaces the
			    message the user may already have typed. */}
			{/* NOT a live region. `role="status"` is implicitly `aria-atomic`, so a timer ticking inside
			    it re-announces the entire panel — controls and all — once per second for the length of
			    the take. The state change is announced once, by the mic button's `aria-pressed`. */}
			{(isRecording || isTranscribing) && (
				<div style={recordingPanelStyle}>
					<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
						<span
							aria-hidden="true"
							style={{
								width: 8,
								height: 8,
								borderRadius: '50%',
								backgroundColor: isRecording ? chatTheme.red : chatTheme.textMuted,
								display: 'inline-block'
							}}
						/>
						{isRecording ? formatElapsed(elapsed) : t('AI_ASSISTANT.TRANSCRIBING', 'Transcribing…')}
					</span>

					{isRecording && (
						<>
							<span aria-hidden="true" style={{ opacity: 0.4 }}>
								|
							</span>
							<label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
								<input
									type="checkbox"
									checked={autoSend}
									onChange={(e) => setAutoSend(e.target.checked)}
									style={{ margin: 0, cursor: 'pointer' }}
								/>
								{t('AI_ASSISTANT.AUTO_SEND', 'Auto-send')}
							</label>

							<span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}>
								<button type="button" onClick={cancelDictation} style={panelButtonStyle(false)}>
									{t('AI_ASSISTANT.CANCEL', 'Cancel')}
								</button>
								<button type="button" onClick={finishDictation} style={panelButtonStyle(true)}>
									{t('AI_ASSISTANT.DONE', 'Done')}
								</button>
							</span>
						</>
					)}
				</div>
			)}

			{dictationError && (
				<div
					role="alert"
					style={{
						display: 'flex',
						alignItems: 'flex-start',
						gap: 6,
						marginBottom: 6,
						fontSize: chatTheme.fontSizeSmall,
						color: chatTheme.red
					}}
				>
					<span style={{ flex: 1 }}>{dictationError}</span>
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
				{/* Attach and library are placeholders on purpose — the control is shown so the
				    affordance is discoverable, and disabled so it cannot fail silently when clicked. */}
				{/* `aria-disabled`, NOT the native `disabled`: that removes the control from the tab
				    order and suppresses its tooltip, so the "coming soon" hint the comment calls
				    discoverable would be reachable by neither keyboard nor hover. This keeps it
				    focusable and announced, and the no-op click keeps it inert. */}
				<button
					type="button"
					aria-disabled="true"
					onClick={(e) => e.preventDefault()}
					style={toolButtonStyle(false, false)}
					title={t('AI_ASSISTANT.ATTACH_SOON', 'Attach files or folders (coming soon)')}
					aria-label={t('AI_ASSISTANT.ATTACH_SOON', 'Attach files or folders (coming soon)')}
				>
					<svg
						width="16"
						height="16"
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
					aria-disabled="true"
					onClick={(e) => e.preventDefault()}
					style={toolButtonStyle(false, false)}
					title={t('AI_ASSISTANT.LIBRARY_SOON', 'Choose from the file library (coming soon)')}
					aria-label={t('AI_ASSISTANT.LIBRARY_SOON', 'Choose from the file library (coming soon)')}
				>
					<svg
						width="16"
						height="16"
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
						style={toolButtonStyle(isRecording, !isTranscribing)}
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
						<svg
							width="16"
							height="16"
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
					</button>
				)}

				<textarea
					ref={textareaRef}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					onKeyDown={handleKeyDown}
					onFocus={() => setIsFocused(true)}
					onBlur={() => setIsFocused(false)}
					placeholder={t('AI_ASSISTANT.PLACEHOLDER', 'Type a message…')}
					rows={1}
					style={textareaStyle}
					aria-label={t('AI_ASSISTANT.PLACEHOLDER', 'Type a message…')}
				/>

				{isBusy ? (
					<button
						type="button"
						onClick={onStop}
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
						disabled={!value.trim()}
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
			</form>
		</div>
	);
}
