import { useRef, useEffect, type CSSProperties } from 'react';
import type { UIMessage } from 'ai';
import { ChatMessageItem } from './ChatMessageItem';
import { chatTheme } from '../chat-theme';

export interface ChatMessageListProps {
	messages: UIMessage[];
	/** Chat status from useChat: 'submitted' | 'streaming' | 'ready' | 'error'. */
	status: string;
	/** Respond to a pending tool approval request. */
	onApprovalResponse?: (approvalId: string, approved: boolean) => void;
}

/**
 * ChatMessageList
 *
 * Scrollable container for chat messages. Auto-scrolls to
 * the bottom when new content streams in. Compact layout
 * optimised for the narrow sidebar width.
 */
export function ChatMessageList({ messages, status, onApprovalResponse }: ChatMessageListProps) {
	const scrollRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const el = scrollRef.current;
		if (el) {
			el.scrollTop = el.scrollHeight;
		}
	}, [messages, status]);

	const containerStyle: CSSProperties = {
		flex: 1,
		overflowY: 'auto',
		padding: '10px',
		display: 'flex',
		flexDirection: 'column',
		gap: 8
	};

	const lastMessage = messages[messages.length - 1];
	const isStreaming = status === 'streaming';

	return (
		<div ref={scrollRef} style={containerStyle}>
			{messages.map((message) => (
				<ChatMessageItem
					key={message.id}
					message={message}
					isStreaming={isStreaming && message === lastMessage && message.role === 'assistant'}
					onApprovalResponse={onApprovalResponse}
				/>
			))}

			{/* Typing indicator — model is thinking, nothing streamed yet */}
			{status === 'submitted' && lastMessage?.role === 'user' && <TypingIndicator />}
		</div>
	);
}

// ── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
	const bubbleStyle: CSSProperties = {
		backgroundColor: chatTheme.assistantBubbleBg,
		borderRadius: `${chatTheme.bubbleRadius} ${chatTheme.bubbleRadius} ${chatTheme.bubbleRadius} 4px`,
		padding: '10px 14px',
		display: 'inline-flex',
		alignItems: 'center',
		gap: 4,
		animation: 'fadeIn 0.2s ease'
	};

	const dotBase: CSSProperties = {
		width: 5,
		height: 5,
		borderRadius: '50%',
		backgroundColor: chatTheme.textSecondary
	};

	return (
		<div>
			<div style={bubbleStyle}>
				<span style={{ ...dotBase, animation: 'typingDot 1.4s ease-in-out infinite' }} />
				<span style={{ ...dotBase, animation: 'typingDot 1.4s ease-in-out 0.2s infinite' }} />
				<span style={{ ...dotBase, animation: 'typingDot 1.4s ease-in-out 0.4s infinite' }} />
			</div>
		</div>
	);
}
