import { type CSSProperties, type ReactNode } from 'react';
import { playgroundTheme as t } from '../../playground-theme';

export interface PlaygroundChatMessageProps {
	role: 'user' | 'assistant' | 'system';
	content: string;
	avatar?: ReactNode;
	timestamp?: string;
}

/**
 * PlaygroundChatMessage — a single message bubble for user or assistant
 * in the playground chat panel. User messages right-aligned, assistant
 * messages left-aligned.
 */
export function PlaygroundChatMessage({ role, content, avatar, timestamp }: PlaygroundChatMessageProps) {
	const isUser = role === 'user';
	const defaultInitial = isUser ? 'U' : 'AI';

	const containerStyle: CSSProperties = {
		display: 'flex',
		gap: '0.75rem',
		padding: '0.75rem 1rem',
		flexDirection: isUser ? 'row-reverse' : 'row',
		alignItems: 'flex-start'
	};

	const avatarStyle: CSSProperties = {
		width: '1.75rem',
		height: '1.75rem',
		borderRadius: '50%',
		background: isUser ? t.accent : t.textSecondary,
		color: '#fff',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		fontSize: t.fontSizeXs,
		fontWeight: 700,
		flexShrink: 0,
		userSelect: 'none'
	};

	const bubbleStyle: CSSProperties = {
		maxWidth: '80%',
		padding: '0.625rem 0.875rem',
		borderRadius: t.radiusLg,
		background: isUser ? t.accent : t.bgInput,
		color: isUser ? '#fff' : t.textPrimary,
		fontSize: t.fontSizeBase,
		lineHeight: 1.55,
		whiteSpace: 'pre-wrap',
		wordBreak: 'break-word'
	};

	return (
		<div style={containerStyle}>
			<div style={avatarStyle}>{avatar ?? defaultInitial}</div>
			<div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
				<div style={bubbleStyle}>{content}</div>
				{timestamp && (
					<span style={{ fontSize: t.fontSizeXs, color: t.textHint, marginTop: '0.25rem' }}>
						{new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
					</span>
				)}
			</div>
		</div>
	);
}
