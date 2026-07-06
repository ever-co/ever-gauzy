import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type PointerEvent as ReactPointerEvent
} from 'react';
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
import { useAngularSignal } from '../use-angular-signal';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import { ChatWelcome } from './ChatWelcome';
import { ChatHistoryPanel, type IChatHistoryItem } from './ChatHistoryPanel';
import { chatTheme } from '../chat-theme';

/**
 * Client-generated conversation id (UUID v4, crypto-secure).
 * `crypto.randomUUID` is available in every browser Angular 21 supports.
 */
function newConversationId(): string {
	return crypto.randomUUID();
}

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

	// Conversation persistence: a client-generated id sent with every turn;
	// the backend saves the full message list for the current user.
	const conversationIdRef = useRef<string>(newConversationId());
	const [activeConversationId, setActiveConversationId] = useState(conversationIdRef.current);
	const [showHistory, setShowHistory] = useState(false);
	const [history, setHistory] = useState<IChatHistoryItem[]>([]);
	const [historyLoading, setHistoryLoading] = useState(false);

	// Docking / maximize state comes straight from the Angular
	// ChatSidebarService signals — they also change outside this panel
	// (e.g. collapsing clears maximized), so a live bridge is required.
	const dockSide = useAngularSignal(injector, chatSidebar.position);
	const isMaximized = useAngularSignal(injector, chatSidebar.maximized);
	const rootRef = useRef<HTMLDivElement>(null);

	const authHeaders = useCallback(
		(): Record<string, string> => ({
			Authorization: `Bearer ${store.token}`,
			...(store.tenantId ? { 'Tenant-Id': store.tenantId } : {}),
			...(store.organizationId ? { 'Organization-Id': store.organizationId } : {})
		}),
		[store]
	);

	const transport = useMemo(
		() =>
			new DefaultChatTransport({
				api: `${environment.API_BASE_URL}/api/ai-chat`,
				headers: authHeaders,
				body: () => ({ conversationId: conversationIdRef.current })
			}),
		[authHeaders]
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
		conversationIdRef.current = newConversationId();
		setActiveConversationId(conversationIdRef.current);
		setShowHistory(false);
	}, [stop, setMessages]);

	const handleApprovalResponse = useCallback(
		(id: string, approved: boolean) => {
			void addToolApprovalResponse({ id, approved });
		},
		[addToolApprovalResponse]
	);

	const handleCollapse = useCallback(() => chatSidebar.collapse(), [chatSidebar]);

	const handleMoveSide = useCallback(() => chatSidebar.togglePosition(), [chatSidebar]);

	const handleToggleMaximize = useCallback(() => chatSidebar.toggleMaximized(), [chatSidebar]);

	// ── Drag-to-resize (grip on the canvas-facing edge) ──────────
	// Window listeners are tracked in a ref so a drag interrupted by
	// `pointercancel` (touch gesture takeover) or component unmount
	// never leaks them.
	const endResizeRef = useRef<(() => void) | null>(null);
	useEffect(() => () => endResizeRef.current?.(), []);

	const handleResizeStart = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			event.preventDefault();
			const host = rootRef.current;
			if (!host) return;
			endResizeRef.current?.();
			const rect = host.getBoundingClientRect();
			const side = chatSidebar.position();
			const onMove = (move: PointerEvent) => {
				const width = side === 'start' ? move.clientX - rect.left : rect.right - move.clientX;
				chatSidebar.setWidth(width);
			};
			const end = () => {
				window.removeEventListener('pointermove', onMove);
				window.removeEventListener('pointerup', end);
				window.removeEventListener('pointercancel', end);
				endResizeRef.current = null;
			};
			endResizeRef.current = end;
			window.addEventListener('pointermove', onMove);
			window.addEventListener('pointerup', end);
			window.addEventListener('pointercancel', end);
		},
		[chatSidebar]
	);

	// ── Conversation history (server-side, current user only) ────
	const conversationsUrl = `${environment.API_BASE_URL}/api/ai-chat/conversations`;

	const openHistory = useCallback(() => {
		setShowHistory(true);
		setHistoryLoading(true);
		fetch(conversationsUrl, { headers: authHeaders() })
			.then((response) => (response.ok ? response.json() : []))
			.then((items) => setHistory(Array.isArray(items) ? items : items?.items ?? []))
			.catch(() => setHistory([]))
			.finally(() => setHistoryLoading(false));
	}, [conversationsUrl, authHeaders]);

	const handleSelectConversation = useCallback(
		(id: string) => {
			fetch(`${conversationsUrl}/${id}`, { headers: authHeaders() })
				.then((response) => (response.ok ? response.json() : null))
				.then((conversation) => {
					if (!conversation) return;
					void stop();
					conversationIdRef.current = conversation.id;
					setActiveConversationId(conversation.id);
					setMessages((conversation.messages ?? []) as never);
					setShowHistory(false);
				})
				.catch(() => setShowHistory(false));
		},
		[conversationsUrl, authHeaders, stop, setMessages]
	);

	const handleDeleteConversation = useCallback(
		(id: string) => {
			fetch(`${conversationsUrl}/${id}`, { method: 'DELETE', headers: authHeaders() })
				.then((response) => {
					// Keep the item in the list if the server refused the delete.
					if (!response.ok) return;
					setHistory((items) => items.filter((item) => item.id !== id));
					if (id === conversationIdRef.current) {
						handleNewChat();
					}
				})
				.catch(() => undefined);
		},
		[conversationsUrl, authHeaders, handleNewChat]
	);

	// ── Styles ──────────────────────────────────────────────────
	const containerStyle: CSSProperties = {
		fontFamily: chatTheme.fontFamily,
		display: 'flex',
		flexDirection: 'column',
		height: '100%',
		// Hard width containment: the panel must never grow past its host,
		// no matter how wide the streamed content's min-content size is.
		width: '100%',
		minWidth: 0,
		maxWidth: '100%',
		overflow: 'hidden',
		position: 'relative'
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
		overflow: 'hidden',
		minWidth: 0
	};

	const resizeHandleStyle: CSSProperties = {
		position: 'absolute',
		top: 0,
		bottom: 0,
		[dockSide === 'start' ? 'right' : 'left']: 0,
		width: 6,
		cursor: 'col-resize',
		zIndex: 6,
		// A touch drag on the grip must resize, not scroll/zoom the page.
		touchAction: 'none',
		// Invisible until hovered — then a subtle accent strip.
		background: 'transparent'
	};

	return (
		<div ref={rootRef} style={containerStyle}>
			{/* Inline keyframes + width containment for streamed markdown:
			    wide content (code blocks, tables) must scroll inside its own
			    box instead of stretching the narrow panel and squeezing the
			    input row. */}
			<style>{`
				@keyframes fadeIn {
					from { opacity: 0; transform: translateY(4px); }
					to { opacity: 1; transform: translateY(0); }
				}
				@keyframes typingDot {
					0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
					40% { transform: scale(1); opacity: 1; }
				}
				.gz-ai-chat-markdown { max-width: 100%; min-width: 0; overflow-wrap: anywhere; }
				.gz-ai-chat-markdown pre {
					max-width: 100%; overflow-x: auto; white-space: pre;
					font-size: 0.75rem; border-radius: 8px;
				}
				.gz-ai-chat-markdown code { overflow-wrap: anywhere; }
				.gz-ai-chat-markdown table {
					display: block; max-width: 100%; width: fit-content;
					overflow-x: auto; font-size: 0.75rem;
				}
				.gz-ai-chat-markdown img, .gz-ai-chat-markdown video { max-width: 100%; height: auto; }
				.gz-ai-chat-resize:hover { background: rgba(51, 102, 255, 0.35) !important; }
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
					<button onClick={openHistory} style={headerBtnStyle} title="History" aria-label="Conversation history">
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
							<circle cx="12" cy="12" r="10" />
							<polyline points="12 6 12 12 16 14" />
						</svg>
					</button>
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
						onClick={handleMoveSide}
						style={headerBtnStyle}
						title={dockSide === 'start' ? 'Dock chat to the right side' : 'Dock chat to the left side'}
						aria-label={dockSide === 'start' ? 'Dock chat to the right side' : 'Dock chat to the left side'}
					>
						{/* Arrow pointing toward the side the chat will move to */}
						{dockSide === 'start' ? (
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
								<line x1="3" y1="12" x2="15" y2="12" />
								<polyline points="10 7 15 12 10 17" />
								<line x1="20" y1="4" x2="20" y2="20" />
							</svg>
						) : (
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
								<line x1="21" y1="12" x2="9" y2="12" />
								<polyline points="14 7 9 12 14 17" />
								<line x1="4" y1="4" x2="4" y2="20" />
							</svg>
						)}
					</button>
					<button
						onClick={handleToggleMaximize}
						style={headerBtnStyle}
						title={isMaximized ? 'Restore chat width' : 'Maximize chat (hide the page)'}
						aria-label={isMaximized ? 'Restore chat width' : 'Maximize chat'}
					>
						{isMaximized ? (
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
								<polyline points="4 14 10 14 10 20" />
								<polyline points="20 10 14 10 14 4" />
								<line x1="14" y1="10" x2="21" y2="3" />
								<line x1="3" y1="21" x2="10" y2="14" />
							</svg>
						) : (
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
								<polyline points="15 3 21 3 21 9" />
								<polyline points="9 21 3 21 3 15" />
								<line x1="21" y1="3" x2="14" y2="10" />
								<line x1="3" y1="21" x2="10" y2="14" />
							</svg>
						)}
					</button>
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

			{/* Conversation history overlay */}
			{showHistory && (
				<ChatHistoryPanel
					items={history}
					loading={historyLoading}
					activeId={activeConversationId}
					onSelect={handleSelectConversation}
					onDelete={handleDeleteConversation}
					onClose={() => setShowHistory(false)}
				/>
			)}

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

			{/* Drag-to-resize grip on the canvas-facing edge */}
			{!isMaximized && (
				<div
					className="gz-ai-chat-resize"
					style={resizeHandleStyle}
					onPointerDown={handleResizeStart}
					role="separator"
					aria-orientation="vertical"
					aria-label="Resize chat panel"
				/>
			)}
		</div>
	);
}
