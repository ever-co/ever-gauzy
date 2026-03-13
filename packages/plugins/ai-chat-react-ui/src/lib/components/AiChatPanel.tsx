import { useState, useCallback, useEffect, type CSSProperties } from 'react';
import { useChat, type Message } from '@ai-sdk/react';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import { ChatWelcome } from './ChatWelcome';
import { chatTheme } from '../chat-theme';

/**
 * AiChatPanel
 *
 * Full-height AI Chat panel designed for a dedicated sidebar.
 * Renders as a separate panel between the nav menu sidebar and
 * the main page content: `Sidebar Menu | Chat AI Sidebar | Page Content`.
 *
 * The panel is always expanded when visible — show/hide is controlled
 * by the Angular layout's `nb-sidebar` visibility.
 *
 * Uses the Vercel AI SDK `useChat` hook from `@ai-sdk/react`.
 * The `api` endpoint is a placeholder until the backend is ready.
 */
export function AiChatPanel() {
	const { messages, input, handleInputChange, handleSubmit, isLoading, stop, reload, error, setMessages } = useChat({
		api: '/api/chat',
		initialMessages: [] as Message[]
	});

	const handleNewChat = useCallback(() => setMessages([]), [setMessages]);

	// ── Styles ──────────────────────────────────────────────────
	const containerStyle: CSSProperties = {
		fontFamily: chatTheme.fontFamily,
		display: 'flex',
		flexDirection: 'column',
		height: '100%',
		overflow: 'hidden'
	};

	const toolbarStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'flex-end',
		padding: '4px 8px',
		borderBottom: `1px solid ${chatTheme.border}`,
		flexShrink: 0
	};

	const newChatBtnStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		gap: 4,
		padding: '4px 10px',
		borderRadius: 6,
		border: 'none',
		backgroundColor: 'transparent',
		color: chatTheme.textSecondary,
		cursor: 'pointer',
		fontSize: chatTheme.fontSizeSmall,
		transition: `all ${chatTheme.transitionSpeed} ease`
	};

	const bodyStyle: CSSProperties = {
		flex: 1,
		display: 'flex',
		flexDirection: 'column',
		overflow: 'hidden'
	};

	const hasMessages = messages.length > 0;

	return (
		<div style={containerStyle}>
			{/* Inline keyframe animations */}
			<style>{`
				@keyframes fadeIn {
					from { opacity: 0; transform: translateY(4px); }
					to { opacity: 1; transform: translateY(0); }
				}
				@keyframes typingDot {
					0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
					40% { transform: scale(1); opacity: 1; }
				}
			`}</style>

			{/* Toolbar with new chat button */}
			{hasMessages && (
				<div style={toolbarStyle}>
					<button
						onClick={handleNewChat}
						style={newChatBtnStyle}
						title="New conversation"
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor = chatTheme.toggleBarHoverBg;
							e.currentTarget.style.color = chatTheme.textPrimary;
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor = 'transparent';
							e.currentTarget.style.color = chatTheme.textSecondary;
						}}
					>
						<svg
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="M12 20h9" />
							<path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
						</svg>
						New chat
					</button>
				</div>
			)}

			{/* Chat body — fills remaining height */}
			<div style={bodyStyle}>
				{hasMessages ? <ChatMessageList messages={messages} isLoading={isLoading} /> : <ChatWelcome />}

				{/* Error bar */}
				{error && (
					<div
						style={{
							padding: '6px 12px',
							backgroundColor: 'rgba(255, 61, 113, 0.15)',
							color: chatTheme.red,
							fontSize: chatTheme.fontSizeSmall,
							borderTop: `1px solid ${chatTheme.border}`,
							display: 'flex',
							alignItems: 'center',
							gap: 6
						}}
					>
						<span>⚠</span>
						<span>Error occurred.</span>
						<button
							onClick={() => reload()}
							style={{
								background: 'none',
								border: 'none',
								color: chatTheme.accent,
								cursor: 'pointer',
								textDecoration: 'underline',
								fontSize: chatTheme.fontSizeSmall,
								padding: 0
							}}
						>
							Retry
						</button>
					</div>
				)}

				{/* Input area */}
				<ChatInput
					input={input}
					isLoading={isLoading}
					onInputChange={handleInputChange}
					onSubmit={handleSubmit}
					onStop={stop}
				/>
			</div>
		</div>
	);
}
