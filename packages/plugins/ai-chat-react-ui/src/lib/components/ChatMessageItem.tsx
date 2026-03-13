import { type CSSProperties } from 'react';
import type { Message } from '@ai-sdk/react';
import { MarkdownContent } from './MarkdownContent';
import { chatTheme } from '../chat-theme';

export interface ChatMessageItemProps {
	message: Message;
}

/**
 * ChatMessageItem
 *
 * Compact message bubble for the inline sidebar chat.
 * No avatars — the narrow sidebar width requires maximum
 * content space. User messages are right-aligned (accent),
 * assistant messages are left-aligned (semi-transparent).
 */
export function ChatMessageItem({ message }: ChatMessageItemProps) {
	const isUser = message.role === 'user';

	const rowStyle: CSSProperties = {
		display: 'flex',
		justifyContent: isUser ? 'flex-end' : 'flex-start',
		animation: 'fadeIn 0.2s ease'
	};

	const bubbleStyle: CSSProperties = {
		maxWidth: '90%',
		padding: '8px 12px',
		borderRadius: isUser
			? `${chatTheme.bubbleRadius} ${chatTheme.bubbleRadius} 4px ${chatTheme.bubbleRadius}`
			: `${chatTheme.bubbleRadius} ${chatTheme.bubbleRadius} ${chatTheme.bubbleRadius} 4px`,
		backgroundColor: isUser ? chatTheme.userBubbleBg : chatTheme.assistantBubbleBg,
		color: isUser ? chatTheme.userBubbleText : chatTheme.assistantBubbleText,
		fontSize: chatTheme.fontSizeBase,
		lineHeight: 1.5,
		wordBreak: 'break-word'
	};

	const timestampStyle: CSSProperties = {
		fontSize: '0.625rem',
		color: chatTheme.textHint,
		marginTop: 2,
		textAlign: isUser ? 'right' : 'left'
	};

	const createdAt = message.createdAt
		? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
		: '';

	return (
		<div>
			<div style={rowStyle}>
				<div style={bubbleStyle}>
					{isUser ? <span>{message.content}</span> : <MarkdownContent content={message.content} />}
				</div>
			</div>
			{createdAt && <div style={timestampStyle}>{createdAt}</div>}
		</div>
	);
}
