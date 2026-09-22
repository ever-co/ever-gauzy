import { type CSSProperties, useState, useRef, type KeyboardEvent } from 'react';
import { playgroundTheme as t } from '../../playground-theme';

export interface PlaygroundChatInputProps {
	onSend: (message: string) => void;
	disabled?: boolean;
	placeholder?: string;
}

/**
 * PlaygroundChatInput — textarea + send button at the bottom of the
 * playground chat panel. Supports Enter to send (Shift+Enter for newline).
 */
export function PlaygroundChatInput({
	onSend,
	disabled = false,
	placeholder = 'Send a message…'
}: PlaygroundChatInputProps) {
	const [value, setValue] = useState('');
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	function send() {
		const trimmed = value.trim();
		if (!trimmed || disabled) return;
		onSend(trimmed);
		setValue('');
		if (textareaRef.current) {
			textareaRef.current.style.height = 'auto';
		}
	}

	function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}

	function autoResize() {
		const el = textareaRef.current;
		if (el) {
			el.style.height = 'auto';
			el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
		}
	}

	const hasContent = value.trim().length > 0;

	const wrapperStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'flex-end',
		gap: '0.5rem',
		padding: '0.75rem 1rem',
		borderTop: `1px solid ${t.border}`,
		background: t.bg
	};

	const textareaStyle: CSSProperties = {
		flex: 1,
		padding: '0.625rem 0.875rem',
		fontSize: t.fontSizeBase,
		fontFamily: t.font,
		color: t.textPrimary,
		background: t.bgInput,
		border: `1px solid ${t.border}`,
		borderRadius: t.radiusLg,
		outline: 'none',
		resize: 'none',
		minHeight: '2.5rem',
		maxHeight: '10rem',
		lineHeight: 1.5,
		overflow: 'auto',
		boxSizing: 'border-box' as const
	};

	const buttonStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: '2.25rem',
		height: '2.25rem',
		borderRadius: '50%',
		border: 'none',
		background: hasContent && !disabled ? t.accent : t.border,
		color: '#fff',
		cursor: hasContent && !disabled ? 'pointer' : 'default',
		transition: `background ${t.transition}`,
		flexShrink: 0
	};

	return (
		<div style={wrapperStyle}>
			<textarea
				ref={textareaRef}
				style={textareaStyle}
				value={value}
				onChange={(e) => {
					setValue(e.target.value);
					autoResize();
				}}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				disabled={disabled}
				rows={1}
				aria-label="Chat message input"
			/>
			<button
				type="button"
				style={buttonStyle}
				onClick={send}
				disabled={disabled || !hasContent}
				aria-label="Send message"
			>
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
					<path d="M3 13V9.667L7.333 8 3 6.333V3l11 5-11 5z" fill="currentColor" />
				</svg>
			</button>
		</div>
	);
}
