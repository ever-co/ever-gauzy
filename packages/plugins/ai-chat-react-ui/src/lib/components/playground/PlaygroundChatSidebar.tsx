import { useState, useCallback, type CSSProperties } from 'react';
import { playgroundTheme as t } from '../../playground-theme';
import { PlaygroundChatPanel } from './PlaygroundChatPanel';
import { type PlaygroundChatMessageProps } from './PlaygroundChatMessage';

/**
 * PlaygroundChatSidebar — standalone chat-only panel designed to render
 * inside a collapsible right sidebar (`nb-sidebar`). No settings panel.
 *
 * Manages its own message state internally. Includes a compact header
 * with title and "New Chat" button.
 */
export function PlaygroundChatSidebar() {
	const [messages, setMessages] = useState<PlaygroundChatMessageProps[]>([]);

	const handleSend = useCallback((text: string) => {
		setMessages((prev) => [...prev, { role: 'user' as const, content: text, timestamp: new Date().toISOString() }]);
	}, []);

	const handleNewChat = useCallback(() => {
		setMessages([]);
	}, []);

	const containerStyle: CSSProperties = {
		display: 'flex',
		flexDirection: 'column',
		height: '100%',
		fontFamily: t.font,
		background: t.bg,
		color: t.textPrimary,
		overflow: 'hidden'
	};

	const headerStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: '0.75rem 1rem',
		borderBottom: `1px solid ${t.border}`,
		flexShrink: 0
	};

	const titleStyle: CSSProperties = {
		fontSize: t.fontSizeLg,
		fontWeight: 700,
		color: t.textPrimary,
		letterSpacing: '-0.01em'
	};

	const newChatBtnStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		gap: '0.25rem',
		padding: '0.25rem 0.5rem',
		fontSize: t.fontSizeXs,
		fontWeight: 500,
		fontFamily: t.font,
		color: t.accent,
		background: t.accentSubtle,
		border: `1px solid ${t.accent}33`,
		borderRadius: t.radius,
		cursor: 'pointer',
		transition: `background ${t.transition}`
	};

	return (
		<div style={containerStyle}>
			<style>{`
				@keyframes pgPulse {
					0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
					40% { transform: scale(1); opacity: 1; }
				}
			`}</style>

			<div style={headerStyle}>
				<span style={titleStyle}>AI Chat</span>
				{messages.length > 0 && (
					<button type="button" style={newChatBtnStyle} onClick={handleNewChat}>
						<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
							<path d="M8 2.5a.5.5 0 01.5.5v4.5H13a.5.5 0 010 1H8.5V13a.5.5 0 01-1 0V8.5H3a.5.5 0 010-1h4.5V3a.5.5 0 01.5-.5z" />
						</svg>
						New Chat
					</button>
				)}
			</div>

			<PlaygroundChatPanel messages={messages} onSend={handleSend} loading={false} />
		</div>
	);
}
