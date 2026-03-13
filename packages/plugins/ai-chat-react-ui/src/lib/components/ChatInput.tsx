import {
	type CSSProperties,
	type FormEvent,
	type ChangeEvent,
	type KeyboardEvent,
	useRef,
	useEffect,
	useState
} from 'react';
import { chatTheme } from '../chat-theme';

export interface ChatInputProps {
	input: string;
	isLoading: boolean;
	onInputChange: (e: ChangeEvent<HTMLTextAreaElement> | ChangeEvent<HTMLInputElement>) => void;
	onSubmit: (e: FormEvent<HTMLFormElement>) => void;
	onStop: () => void;
}

/**
 * ChatInput
 *
 * Compact input area for the inline sidebar chat. Features:
 * - Auto-resizing textarea (up to 3 lines)
 * - Enter to send, Shift+Enter for newline
 * - Send / Stop button depending on loading state
 *
 * Styled for dark sidebar backgrounds.
 */
export function ChatInput({ input, isLoading, onInputChange, onSubmit, onStop }: ChatInputProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [isFocused, setIsFocused] = useState(false);

	// Auto-resize textarea
	useEffect(() => {
		const el = textareaRef.current;
		if (el) {
			el.style.height = 'auto';
			el.style.height = `${Math.min(el.scrollHeight, 80)}px`;
		}
	}, [input]);

	// Handle Enter to submit, Shift+Enter for newline
	function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			if (input.trim() && !isLoading) {
				const syntheticEvent = new Event('submit', { bubbles: true, cancelable: true });
				(e.target as HTMLElement).closest('form')?.dispatchEvent(syntheticEvent);
			}
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
		margin: 0
	};

	const buttonStyle: CSSProperties = {
		width: 28,
		height: 28,
		borderRadius: '50%',
		backgroundColor: isLoading ? chatTheme.red : chatTheme.accent,
		color: '#ffffff',
		border: 'none',
		cursor: 'pointer',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		flexShrink: 0,
		transition: `background-color ${chatTheme.transitionSpeed} ease`,
		opacity: !isLoading && !input.trim() ? 0.4 : 1,
		outline: 'none'
	};

	return (
		<div style={containerStyle}>
			<form onSubmit={onSubmit} style={formStyle}>
				<textarea
					ref={textareaRef}
					value={input}
					onChange={onInputChange}
					onKeyDown={handleKeyDown}
					onFocus={() => setIsFocused(true)}
					onBlur={() => setIsFocused(false)}
					placeholder="Type a message…"
					rows={1}
					style={textareaStyle}
					aria-label="Chat message input"
				/>

				{isLoading ? (
					<button
						type="button"
						onClick={onStop}
						style={buttonStyle}
						title="Stop generating"
						aria-label="Stop"
					>
						<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
							<rect x="6" y="6" width="12" height="12" rx="2" />
						</svg>
					</button>
				) : (
					<button
						type="submit"
						disabled={!input.trim()}
						style={buttonStyle}
						title="Send message"
						aria-label="Send"
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
