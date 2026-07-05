import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { useChat } from '@ai-sdk/react';
import {
	DefaultChatTransport,
	lastAssistantMessageIsCompleteWithApprovalResponses,
	lastAssistantMessageIsCompleteWithToolCalls
} from 'ai';
import { useInjector } from '@gauzy/ui-react';
import { ChatSidebarService, Store } from '@gauzy/ui-core/core';
import { environment } from '@gauzy/ui-config';
import { executeClientTool, isClientTool } from '../chat-client-tools';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import { ChatWelcome } from './ChatWelcome';
import { chatTheme } from '../chat-theme';

/**
 * AiChatPanel
 *
 * Full-height AI agent chat panel rendered in the dedicated chat sidebar
 * slot: `Menu | Chat | Page content (canvas)`.
 *
 * Built on the Vercel AI SDK (`useChat` from @ai-sdk/react v4 / AI SDK 7):
 * - streams from the Gauzy backend (`POST /api/ai-chat`) with the user's
 *   own JWT, so the agent can only see and do what the user can;
 * - executes client ("canvas") tools in the browser — open_page /
 *   read_page / fill_form / submit_form — via the Angular bridge services;
 * - renders tool-approval requests inline (Approve / Reject) and resumes
 *   the run automatically once tool results or approvals are complete.
 */
export function AiChatPanel() {
	const injector = useInjector();
	const store = useMemo(() => injector.get(Store), [injector]);
	const chatSidebar = useMemo(() => injector.get(ChatSidebarService), [injector]);
	const [input, setInput] = useState('');

	const transport = useMemo(
		() =>
			new DefaultChatTransport({
				api: `${environment.API_BASE_URL}/api/ai-chat`,
				headers: () => ({
					Authorization: `Bearer ${store.token}`,
					...(store.tenantId ? { 'Tenant-Id': store.tenantId } : {}),
					...(store.organizationId ? { 'Organization-Id': store.organizationId } : {})
				})
			}),
		[store]
	);

	const chat = useChat({
		transport,
		// Resume the agent loop once all client tool results / approvals are in.
		sendAutomaticallyWhen: (options) =>
			lastAssistantMessageIsCompleteWithToolCalls(options) ||
			lastAssistantMessageIsCompleteWithApprovalResponses(options),
		// Client ("canvas") tools run here, in the browser.
		onToolCall: ({ toolCall }) => {
			const { toolName, toolCallId, input: toolInput } = toolCall as {
				toolName: string;
				toolCallId: string;
				input: unknown;
			};
			if (!isClientTool(toolName)) return;
			// Deliberately not awaited — awaiting inside onToolCall deadlocks the stream.
			executeClientTool(injector, toolName, toolInput)
				.then((output) =>
					chat.addToolOutput({ tool: toolName as never, toolCallId, output: output as never })
				)
				.catch((error: unknown) =>
					chat.addToolOutput({
						state: 'output-error',
						tool: toolName as never,
						toolCallId,
						errorText: error instanceof Error ? error.message : String(error)
					})
				);
		}
	});

	const { messages, sendMessage, status, stop, error, regenerate, setMessages, addToolApprovalResponse } = chat;

	const isBusy = status === 'submitted' || status === 'streaming';
	const hasMessages = messages.length > 0;

	const handleSubmit = useCallback(() => {
		const text = input.trim();
		if (!text || isBusy) return;
		setInput('');
		void sendMessage({ text });
	}, [input, isBusy, sendMessage]);

	const handleNewChat = useCallback(() => {
		void stop();
		setMessages([]);
	}, [stop, setMessages]);

	const handleApprovalResponse = useCallback(
		(id: string, approved: boolean) => {
			void addToolApprovalResponse({ id, approved });
		},
		[addToolApprovalResponse]
	);

	const handleCollapse = useCallback(() => chatSidebar.collapse(), [chatSidebar]);

	// ── Styles ──────────────────────────────────────────────────
	const containerStyle: CSSProperties = {
		fontFamily: chatTheme.fontFamily,
		display: 'flex',
		flexDirection: 'column',
		height: '100%',
		overflow: 'hidden'
	};

	const headerStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		gap: 8,
		padding: '8px 12px',
		borderBottom: `1px solid ${chatTheme.border}`,
		flexShrink: 0,
		color: chatTheme.textPrimary,
		fontSize: chatTheme.fontSizeBase,
		fontWeight: 600
	};

	const headerBtnStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: 26,
		height: 26,
		borderRadius: 6,
		border: 'none',
		backgroundColor: 'transparent',
		color: chatTheme.textSecondary,
		cursor: 'pointer',
		padding: 0,
		transition: `all ${chatTheme.transitionSpeed} ease`
	};

	const bodyStyle: CSSProperties = {
		flex: 1,
		display: 'flex',
		flexDirection: 'column',
		overflow: 'hidden'
	};

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

			{/* Header: title + new chat + collapse */}
			<div style={headerStyle}>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke={chatTheme.accent}
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
				</svg>
				<span>AI Assistant</span>

				<span style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
					{hasMessages && (
						<button
							onClick={handleNewChat}
							style={headerBtnStyle}
							title="New conversation"
							aria-label="New conversation"
						>
							<svg
								width="13"
								height="13"
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
						</button>
					)}
					<button
						onClick={handleCollapse}
						style={headerBtnStyle}
						title="Collapse chat"
						aria-label="Collapse chat"
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
							<polyline points="15 18 9 12 15 6" />
						</svg>
					</button>
				</span>
			</div>

			{/* Chat body — fills remaining height */}
			<div style={bodyStyle}>
				{hasMessages ? (
					<ChatMessageList messages={messages} status={status} onApprovalResponse={handleApprovalResponse} />
				) : (
					<ChatWelcome />
				)}

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
						<span>Something went wrong.</span>
						<button
							onClick={() => regenerate()}
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
					value={input}
					isBusy={isBusy}
					onChange={setInput}
					onSubmit={handleSubmit}
					onStop={() => void stop()}
					onEscape={handleCollapse}
				/>
			</div>
		</div>
	);
}
