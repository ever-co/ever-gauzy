import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { chatTheme } from '../chat-theme';
import { type ChatTranslate, passthroughChatTranslate } from '../use-chat-translate';

/** A reply's rating. Kept for the chat session only — nothing stores it on the server yet. */
export type MessageFeedback = 'up' | 'down';

export interface MessageActionsProps {
	/** The reply's markdown (tool calls written out as text already removed). Empty → no copy / read. */
	text: string;
	/** `t(key, fallback)` from the panel. */
	translate?: ChatTranslate;
	/** Present on the latest reply only: run it again. */
	onRegenerate?: () => void;
	/** True while a reply is being generated — Regenerate waits for it. */
	busy?: boolean;
	/** The rating given to this reply in this session, if any. */
	feedback?: MessageFeedback;
	/** Rate the reply; the same rating again clears it. */
	onFeedback?: (feedback: MessageFeedback | undefined) => void;
}

/**
 * The reply as plain prose for the speech engine: no code (it reads as noise), no markup
 * characters, links reduced to their words.
 */
export function toSpeechText(markdown: string): string {
	return markdown
		.replace(/```[\s\S]*?(```|$)/g, ' ')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
		.replace(/`([^`]*)`/g, '$1')
		.replace(/<[^>]+>/g, ' ')
		.replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '')
		// Tables: the separator row goes, every other row is read as "cell, cell."
		.replace(/^[ \t|:-]*\|[ \t|:-]*$/gm, '')
		.replace(/^[ \t]*\|(.*)\|[ \t]*$/gm, (_row, cells: string) =>
			cells
				.split('|')
				.map((cell) => cell.trim())
				.filter(Boolean)
				.join(', ') + '.'
		)
		.replace(/[*_~]+/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Copy text, with the selection fallback for a page that is not a secure context. Rejects when
 * nothing reached the clipboard — a refused permission, an unfocused document, or the fallback
 * reporting failure — so the caller can say so instead of claiming "Copied".
 */
export async function copyText(text: string): Promise<void> {
	if (navigator.clipboard?.writeText && window.isSecureContext) {
		await navigator.clipboard.writeText(text);
		return;
	}
	const area = document.createElement('textarea');
	area.value = text;
	area.setAttribute('readonly', '');
	area.style.position = 'fixed';
	area.style.opacity = '0';
	document.body.appendChild(area);
	area.select();
	let copied = false;
	try {
		copied = document.execCommand('copy');
	} finally {
		document.body.removeChild(area);
	}
	if (!copied) {
		throw new Error('The browser did not copy the text.');
	}
}

const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Icon paths, drawn at 14px with the chat's 2px stroke. */
function Icon({ children, filled }: { children: ReactNode; filled?: boolean }) {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill={filled ? 'currentColor' : 'none'}
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			{children}
		</svg>
	);
}

/**
 * MessageActions
 *
 * The row of quiet icon buttons under an assistant reply: Copy, Read aloud, Good / Bad response
 * and — on the latest reply — Regenerate. Read aloud uses the browser's own speech engine, so it
 * needs no server and no network; starting one reply stops any other being read.
 */
export function MessageActions({
	text,
	translate: t = passthroughChatTranslate,
	onRegenerate,
	busy,
	feedback,
	onFeedback
}: MessageActionsProps) {
	/** What the Copy button shows for a moment after a click. */
	const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
	const [speaking, setSpeaking] = useState(false);
	const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
	const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Leaving the reply (new chat, Maximize, closing the panel) stops its reading and its timer.
	useEffect(
		() => () => {
			if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
			if (canSpeak && utteranceRef.current && window.speechSynthesis.speaking) {
				window.speechSynthesis.cancel();
			}
		},
		[]
	);

	const handleCopy = () => {
		const show = (state: 'copied' | 'failed', ms: number) => {
			setCopyState(state);
			if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
			copiedTimerRef.current = setTimeout(() => setCopyState('idle'), ms);
		};
		// A failure is shown (an ✕ and "Copy failed") rather than swallowed, so the user knows to
		// try again or select the text by hand.
		void copyText(text).then(
			() => show('copied', 1500),
			() => show('failed', 2000)
		);
	};

	const handleSpeak = () => {
		if (!canSpeak) return;
		const synth = window.speechSynthesis;
		if (speaking) {
			synth.cancel();
			return;
		}
		// One voice at a time: cancelling ends any other reply's reading (its `onend` resets it).
		synth.cancel();
		const utterance = new SpeechSynthesisUtterance(toSpeechText(text));
		utterance.lang = document.documentElement.lang || navigator.language;
		const done = () => {
			if (utteranceRef.current === utterance) utteranceRef.current = null;
			setSpeaking(false);
		};
		utterance.onend = done;
		utterance.onerror = done;
		utteranceRef.current = utterance;
		setSpeaking(true);
		synth.speak(utterance);
	};

	const rowStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		gap: 2,
		marginTop: 2,
		color: chatTheme.textHint
	};

	const buttonStyle: CSSProperties = {
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: 26,
		height: 26,
		padding: 0,
		border: 'none',
		borderRadius: 6,
		background: 'transparent',
		color: 'inherit',
		cursor: 'pointer'
	};

	const copyLabel =
		copyState === 'copied'
			? t('AI_ASSISTANT.COPIED', 'Copied')
			: copyState === 'failed'
				? t('AI_ASSISTANT.COPY_FAILED', 'Copy failed')
				: t('AI_ASSISTANT.COPY', 'Copy');
	const speakLabel = speaking
		? t('AI_ASSISTANT.STOP_READING', 'Stop reading')
		: t('AI_ASSISTANT.READ_ALOUD', 'Read aloud');
	const goodLabel = t('AI_ASSISTANT.GOOD_RESPONSE', 'Good response');
	const badLabel = t('AI_ASSISTANT.BAD_RESPONSE', 'Bad response');
	const regenerateLabel = t('AI_ASSISTANT.REGENERATE', 'Regenerate');

	return (
		<div style={rowStyle} className="gz-ai-chat-actions">
			{text && (
				<button
					type="button"
					className="gz-ai-chat-action"
					style={buttonStyle}
					onClick={handleCopy}
					title={copyLabel}
					aria-label={copyLabel}
				>
					{copyState === 'copied' ? (
						<Icon>
							<polyline points="20 6 9 17 4 12" />
						</Icon>
					) : copyState === 'failed' ? (
						<Icon>
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</Icon>
					) : (
						<Icon>
							<rect width="14" height="14" x="8" y="8" rx="2" />
							<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
						</Icon>
					)}
				</button>
			)}

			{text && canSpeak && (
				<button
					type="button"
					className="gz-ai-chat-action"
					style={buttonStyle}
					onClick={handleSpeak}
					title={speakLabel}
					aria-label={speakLabel}
					aria-pressed={speaking}
				>
					{speaking ? (
						<Icon filled>
							<rect width="12" height="12" x="6" y="6" rx="1.5" />
						</Icon>
					) : (
						<Icon>
							<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z" />
							<path d="M16 9a5 5 0 0 1 0 6" />
							<path d="M19.4 18.4a9 9 0 0 0 0-12.8" />
						</Icon>
					)}
				</button>
			)}

			{onFeedback && (
				<>
					<button
						type="button"
						className="gz-ai-chat-action"
						style={buttonStyle}
						onClick={() => onFeedback(feedback === 'up' ? undefined : 'up')}
						title={goodLabel}
						aria-label={goodLabel}
						aria-pressed={feedback === 'up'}
					>
						<Icon filled={feedback === 'up'}>
							<path d="M7 10v12" />
							<path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
						</Icon>
					</button>
					<button
						type="button"
						className="gz-ai-chat-action"
						style={buttonStyle}
						onClick={() => onFeedback(feedback === 'down' ? undefined : 'down')}
						title={badLabel}
						aria-label={badLabel}
						aria-pressed={feedback === 'down'}
					>
						<Icon filled={feedback === 'down'}>
							<path d="M17 14V2" />
							<path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
						</Icon>
					</button>
				</>
			)}

			{onRegenerate && (
				<button
					type="button"
					className="gz-ai-chat-action"
					style={buttonStyle}
					onClick={onRegenerate}
					disabled={busy}
					title={regenerateLabel}
					aria-label={regenerateLabel}
				>
					<Icon>
						<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
						<path d="M21 3v5h-5" />
						<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
						<path d="M8 16H3v5" />
					</Icon>
				</button>
			)}
		</div>
	);
}
