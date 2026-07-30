import { type CSSProperties, type KeyboardEvent, useRef, useEffect, useState } from 'react';
import { chatTheme } from '../chat-theme';
import { type ChatTranslate, passthroughChatTranslate } from '../use-chat-translate';

export interface ChatInputProps {
	value: string;
	/** True while a response is being generated (submit disabled, stop shown). */
	isBusy: boolean;
	/** `t(key, fallback)` from the panel — see `useChatTranslate`. */
	translate?: ChatTranslate;
	onChange: (value: string) => void;
	onSubmit: () => void;
	onStop: () => void;
	/** Called when the user presses Escape (collapse the sidebar). */
	onEscape?: () => void;
}

/**
 * ChatInput
 *
 * Compact input area for the inline sidebar chat. Features:
 * - Auto-resizing textarea (up to 3 lines)
 * - Enter to send, Shift+Enter for newline, Escape to collapse
 * - Send / Stop button depending on generation state
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
	onEscape
}: ChatInputProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [isFocused, setIsFocused] = useState(false);

	// Auto-resize textarea
	useEffect(() => {
		const el = textareaRef.current;
		if (el) {
			el.style.height = 'auto';
			el.style.height = `${Math.min(el.scrollHeight, 80)}px`;
		}
	}, [value]);

	function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
		// Ignore key events fired while an IME composition is active (e.g.
		// confirming Japanese/Chinese candidates with Enter must not submit).
		if (e.nativeEvent.isComposing || e.key === 'Process') return;
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			if (value.trim() && !isBusy) {
				onSubmit();
			}
		} else if (e.key === 'Escape' && onEscape) {
			e.preventDefault();
			onEscape();
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
		lineHeight: 1.5,
		resize: 'none',
		minHeight: 20,
		maxHeight: 80,
		padding: 0,
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
		width: 28,
		height: 28,
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

	return (
		<div style={containerStyle}>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (value.trim() && !isBusy) onSubmit();
				}}
				style={formStyle}
			>
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
