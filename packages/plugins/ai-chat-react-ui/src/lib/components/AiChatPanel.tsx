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
import { AgentPageBridgeService, ChatSidebarService, Store } from '@gauzy/ui-core/core';
import { AI_CHAT_RATE_LIMIT_CODE, PermissionsEnum, type IAiChatRateLimitEnvelope } from '@gauzy/contracts';
import { environment } from '@gauzy/ui-config';
import { executeClientTool, isClientTool } from '../chat-client-tools';
import { useAngularSignal } from '../use-angular-signal';
import { useChatTranslate } from '../use-chat-translate';
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
	const t = useChatTranslate(injector);
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
	// True in the detached window (`/ai-chat/window`): there is no sidebar to
	// dock, maximize, resize or collapse there, so those controls are dropped.
	const isDetachedView = useAngularSignal(injector, chatSidebar.detachedView);
	const rootRef = useRef<HTMLDivElement>(null);

	const authHeaders = useCallback(
		(): Record<string, string> => ({
			Authorization: `Bearer ${store.token}`,
			...(store.tenantId ? { 'Tenant-Id': store.tenantId } : {}),
			...(store.organizationId ? { 'Organization-Id': store.organizationId } : {})
		}),
		[store]
	);

	/**
	 * May this user open the AI Providers settings page?
	 *
	 * Chat only requires AI_CHAT_ACCESS, but the settings route is guarded by AI_CHAT_SETTINGS — so
	 * navigating a chat-only user there would silently bounce them to the settings index.
	 */
	const canOpenAiSettings = useCallback(
		() =>
			(store.userRolePermissions ?? []).some(
				(rolePermission) =>
					rolePermission.permission === PermissionsEnum.AI_CHAT_SETTINGS && rolePermission.enabled
			),
		[store]
	);

	/**
	 * Send a dictation take to the server for transcription.
	 *
	 * `FormData` deliberately WITHOUT a Content-Type header: the browser has to set it, because only
	 * it knows the multipart boundary. Setting it by hand produces a body the server cannot parse.
	 */
	const transcribeAudio = useCallback(
		async (audio: Blob): Promise<string> => {
			const form = new FormData();
			form.append('file', audio, 'dictation');
			const response = await fetch(`${environment.API_BASE_URL}/api/ai-chat/transcribe`, {
				method: 'POST',
				headers: authHeaders(),
				body: form
			});
			if (!response.ok) {
				// The server's message names the actual problem — no speech-capable provider, a
				// rejected key — so it is worth more to the user than a status code.
				const detail = await response
					.json()
					.then((body: { message?: string }) => body?.message)
					.catch(() => undefined);
				throw new Error(detail || `Transcription failed (HTTP ${response.status})`);
			}
			const body = (await response.json()) as { text?: string };
			return body.text ?? '';
		},
		[authHeaders]
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

	/**
	 * Indirection for the stream error handler.
	 *
	 * `useChat`'s `onError` needs `setMessages`, which `useChat` itself returns — a cycle. The ref is
	 * assigned right after the hook, and `onError` can only fire once a request is in flight, so it
	 * is always populated by the time it is read.
	 */
	const handleStreamErrorRef = useRef<((error: unknown) => void) | null>(null);

	const chat = useChat({
		transport,
		// Resume the agent loop once all client tool results / approvals are in.
		sendAutomaticallyWhen: (options) =>
			lastAssistantMessageIsCompleteWithToolCalls(options) ||
			lastAssistantMessageIsCompleteWithApprovalResponses(options),
		// Client ("canvas") tools run here, in the browser.
		onToolCall: ({ toolCall }) => {
			const {
				toolName,
				toolCallId,
				input: toolInput
			} = toolCall as {
				toolName: string;
				toolCallId: string;
				input: unknown;
			};
			if (!isClientTool(toolName)) return;
			// Deliberately not awaited — awaiting inside onToolCall deadlocks the stream.
			executeClientTool(injector, toolName, toolInput)
				.then((output) => chat.addToolOutput({ tool: toolName as never, toolCallId, output: output as never }))
				.catch((error: unknown) =>
					chat.addToolOutput({
						state: 'output-error',
						tool: toolName as never,
						toolCallId,
						errorText: error instanceof Error ? error.message : String(error)
					})
				);
		},
		onError: (streamError: unknown) => handleStreamErrorRef.current?.(streamError)
	});

	const { messages, sendMessage, status, stop, error, regenerate, setMessages, addToolApprovalResponse } = chat;

	/**
	 * The settings page has been opened for a rate limit already this session.
	 *
	 * Every rate limit gets the explanatory message, but the canvas is only taken over ONCE — hitting
	 * a free-tier limit repeatedly is normal, and yanking the user's page away each time would be its
	 * own bug.
	 */
	const rateLimitPageOpenedRef = useRef(false);

	/**
	 * Turn a rate-limited turn into something the user can act on.
	 *
	 * The server sends a JSON envelope through the stream's error channel (the only channel that
	 * exists for this) and masks everything else as a generic string, so anything that does not parse
	 * as our envelope is left to the existing error bar.
	 */
	handleStreamErrorRef.current = (streamError: unknown) => {
		const raw = streamError instanceof Error ? streamError.message : String(streamError ?? '');
		let envelope: IAiChatRateLimitEnvelope | null = null;
		try {
			const parsed = JSON.parse(raw);
			if (parsed?.code === AI_CHAT_RATE_LIMIT_CODE) envelope = parsed as IAiChatRateLimitEnvelope;
		} catch {
			// Not our envelope — a normal error, already handled by the error bar.
		}
		if (!envelope) return;

		// On the shared free key the user can fix this themselves; on their OWN key they cannot, so
		// telling them to "connect your account" would be wrong.
		const onSharedKey = envelope.credentialSource === 'platform';
		const wait = envelope.retryAfterSeconds
			? t('AI_ASSISTANT.RATE_LIMIT_RETRY_IN', 'You can try again in about {{seconds}}s.').replace(
					'{{seconds}}',
					String(envelope.retryAfterSeconds)
				)
			: '';
		const notice = onSharedKey
			? t(
					'AI_ASSISTANT.RATE_LIMITED_SHARED',
					'The free AI tier is rate limited right now. Connect your own OpenRouter account, or configure a different AI provider, for uninterrupted access.'
				)
			: t(
					'AI_ASSISTANT.RATE_LIMITED_OWN',
					'Your AI provider is rate limiting requests right now. Check your plan and limits with the provider, or configure a different AI provider.'
				);

		// Rendered as a normal assistant message so it flows through the existing markdown renderer
		// with no new UI. It is client-only and deliberately not persisted: it describes the state of
		// this attempt, not part of the conversation.
		setMessages((current) => [
			...(current as never[]),
			{
				id: `rate-limit-${Date.now()}`,
				role: 'assistant',
				parts: [{ type: 'text', text: [notice, wait].filter(Boolean).join(' ') }]
			} as never
		]);

		if (!onSharedKey || rateLimitPageOpenedRef.current) return;
		rateLimitPageOpenedRef.current = true;
		// Only navigate if the user could actually do anything there: the chat needs AI_CHAT_ACCESS
		// while the settings route is guarded by AI_CHAT_SETTINGS, so a chat-only user would just be
		// bounced to the settings index. The message above already tells them what to ask for.
		if (!canOpenAiSettings()) return;
		void injector
			.get(AgentPageBridgeService)
			.openPage('/pages/settings/ai', { provider: envelope.providerId })
			.catch(() => undefined);
	};

	const isBusy = status === 'submitted' || status === 'streaming';
	const hasMessages = messages.length > 0;

	/**
	 * Send a message.
	 *
	 * `override` exists for dictation: the transcript is handed straight here rather than being read
	 * back out of `input`. `setInput` is asynchronous, so auto-send fired immediately after it would
	 * otherwise submit the PRE-dictation text — an empty draft sending nothing, a non-empty one
	 * sending only what was typed before the user spoke.
	 */
	const handleSubmit = useCallback(
		(override?: string) => {
			const text = (override ?? input).trim();
			if (!text || isBusy) return;
			setInput('');
			void sendMessage({ text });
		},
		[input, isBusy, sendMessage]
	);

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

	// Opens the chat in its own browser window and closes the docked panel,
	// so the conversation is never live in two places at once.
	const handleDetach = useCallback(() => chatSidebar.detach(), [chatSidebar]);

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
			.then((items) => setHistory(Array.isArray(items) ? items : (items?.items ?? [])))
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
		padding: '8px 10px 8px 12px',
		borderBottom: `1px solid ${chatTheme.border}`,
		flexShrink: 0,
		color: chatTheme.textPrimary,
		fontSize: chatTheme.fontSizeBase,
		fontWeight: 600,
		// Drives the `@container` rule that drops the button words on a narrow
		// panel — the labels are the point, but not at the cost of clipping.
		containerType: 'inline-size'
	};

	// The title yields space before anything else: at 300px (the minimum panel
	// width) the controls matter more than the full word "Assistant".
	const headerTitleStyle: CSSProperties = {
		minWidth: 0,
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap'
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

	// "New chat" and "History" are the two controls people go looking for, so
	// they carry their name instead of hiding behind a glyph.
	const headerBtnLabelledStyle: CSSProperties = {
		...headerBtnStyle,
		width: 'auto',
		gap: 4,
		padding: '0 7px',
		fontFamily: 'inherit',
		fontSize: '0.6875rem',
		fontWeight: 600,
		letterSpacing: '0.01em',
		whiteSpace: 'nowrap'
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
		width: 8,
		cursor: 'col-resize',
		zIndex: 6,
		// A touch drag on the grip must resize, not scroll/zoom the page.
		touchAction: 'none',
		// A faint grip is always drawn (see `.gz-ai-chat-resize::after`); the
		// accent strip only lights up on hover.
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
				/* Panel header controls. Inline styles cannot express :hover, so these
				   buttons gave no feedback at all and read as decoration. */
				.gz-ai-chat-head-btn:hover {
					background-color: color-mix(in srgb, currentColor 12%, transparent) !important;
					color: inherit !important;
				}
				.gz-ai-chat-head-btn:focus-visible {
					outline: 2px solid rgba(51, 102, 255, 0.6);
					outline-offset: 1px;
					color: inherit !important;
				}

				/* Under ~380px the words would clip: keep the icons, drop the labels.
				   title + aria-label still name every control. */
				@container (max-width: 380px) {
					.gz-ai-chat-btn-label { display: none; }
					.gz-ai-chat-head-btn.gz-labelled {
						padding: 0 !important; width: 26px !important; gap: 0 !important;
					}
				}

				/* Drag-to-resize edge. It was a fully transparent 6px strip that showed
				   itself only once the cursor happened to land on it, so nobody found
				   the resize: draw a faint permanent grip, and light it on hover. */
				.gz-ai-chat-resize::after {
					content: '';
					position: absolute;
					top: 50%;
					left: 50%;
					transform: translate(-50%, -50%);
					width: 2px;
					height: 28px;
					border-radius: 2px;
					background: color-mix(in srgb, currentColor 22%, transparent);
					transition: height 0.15s ease, background-color 0.15s ease;
					pointer-events: none;
				}
				.gz-ai-chat-resize:hover { background: rgba(51, 102, 255, 0.35) !important; }
				.gz-ai-chat-resize:hover::after { height: 48px; background: rgba(255, 255, 255, 0.8); }
			`}</style>

			{/* Header: title + history + new chat + dock/maximize/collapse.
			    History and New chat carry their names — they were unlabelled
			    glyphs, which is why people asked whether history existed. */}
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
					style={{ flexShrink: 0 }}
				>
					<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
				</svg>
				<span style={headerTitleStyle}>{t('AI_ASSISTANT.TITLE', 'AI Assistant')}</span>

				<span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
					<button
						type="button"
						onClick={openHistory}
						className="gz-ai-chat-head-btn gz-labelled"
						style={headerBtnLabelledStyle}
						title={t('AI_ASSISTANT.HISTORY_HINT', 'Browse saved conversations')}
						aria-label={t('AI_ASSISTANT.HISTORY_HINT', 'Browse saved conversations')}
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
							style={{ flexShrink: 0 }}
						>
							<circle cx="12" cy="12" r="10" />
							<polyline points="12 6 12 12 16 14" />
						</svg>
						<span className="gz-ai-chat-btn-label">{t('AI_ASSISTANT.HISTORY', 'History')}</span>
					</button>
					{hasMessages && (
						<button
							type="button"
							onClick={handleNewChat}
							className="gz-ai-chat-head-btn gz-labelled"
							style={headerBtnLabelledStyle}
							title={t('AI_ASSISTANT.NEW_CHAT_HINT', 'Start a new conversation')}
							aria-label={t('AI_ASSISTANT.NEW_CHAT_HINT', 'Start a new conversation')}
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
								style={{ flexShrink: 0 }}
							>
								<path d="M12 20h9" />
								<path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
							</svg>
							<span className="gz-ai-chat-btn-label">{t('AI_ASSISTANT.NEW_CHAT', 'New chat')}</span>
						</button>
					)}
					{/* Dock side / maximize / detach / close all describe the DOCKED
					    panel — in the detached window there is no sidebar to move,
					    grow or close, so the whole cluster is dropped there. */}
					{!isDetachedView && (
						<>
							<button
								type="button"
								onClick={handleMoveSide}
								className="gz-ai-chat-head-btn"
								style={headerBtnStyle}
								title={
									dockSide === 'start'
										? t('AI_ASSISTANT.DOCK_RIGHT', 'Dock to the right')
										: t('AI_ASSISTANT.DOCK_LEFT', 'Dock to the left')
								}
								aria-label={
									dockSide === 'start'
										? t('AI_ASSISTANT.DOCK_RIGHT', 'Dock to the right')
										: t('AI_ASSISTANT.DOCK_LEFT', 'Dock to the left')
								}
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
								type="button"
								onClick={handleToggleMaximize}
								className="gz-ai-chat-head-btn"
								style={headerBtnStyle}
								title={
									isMaximized
										? t('AI_ASSISTANT.RESTORE', 'Restore width')
										: t('AI_ASSISTANT.MAXIMIZE', 'Maximize')
								}
								aria-label={
									isMaximized
										? t('AI_ASSISTANT.RESTORE', 'Restore width')
										: t('AI_ASSISTANT.MAXIMIZE', 'Maximize')
								}
								aria-pressed={isMaximized}
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
								type="button"
								onClick={handleDetach}
								className="gz-ai-chat-head-btn"
								style={headerBtnStyle}
								title={t('AI_ASSISTANT.DETACH', 'Open in a new window')}
								aria-label={t('AI_ASSISTANT.DETACH', 'Open in a new window')}
							>
								{/* A window with an arrow leaving it — the chat moves out of
								    the page and into a window of its own. */}
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
									<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
									<polyline points="15 3 21 3 21 9" />
									<line x1="10" y1="14" x2="21" y2="3" />
								</svg>
							</button>
							<button
								type="button"
								onClick={handleCollapse}
								className="gz-ai-chat-head-btn"
								style={headerBtnStyle}
								title={t('AI_ASSISTANT.CLOSE', 'Close AI Assistant')}
								aria-label={t('AI_ASSISTANT.CLOSE', 'Close AI Assistant')}
							>
								{/* The chevron points the way the panel actually leaves — it used
								    to point left even when the chat was docked on the right. */}
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
									{dockSide === 'start' ? (
										<polyline points="15 18 9 12 15 6" />
									) : (
										<polyline points="9 18 15 12 9 6" />
									)}
								</svg>
							</button>
						</>
					)}
				</span>
			</div>

			{/* Conversation history overlay */}
			{showHistory && (
				<ChatHistoryPanel
					items={history}
					loading={historyLoading}
					activeId={activeConversationId}
					translate={t}
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
					<ChatWelcome translate={t} />
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
						<span>{t('AI_ASSISTANT.ERROR', 'Something went wrong.')}</span>
						<button
							type="button"
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
							{t('AI_ASSISTANT.RETRY', 'Retry')}
						</button>
					</div>
				)}

				{/* Input area. Escape closes the docked panel; in the detached window
				    it must do nothing — collapse() persists the docked state for the
				    next page load, and there is no panel here to close. */}
				<ChatInput
					value={input}
					isBusy={isBusy}
					translate={t}
					onChange={setInput}
					onSubmit={handleSubmit}
					onStop={() => void stop()}
					onEscape={isDetachedView ? undefined : handleCollapse}
					onTranscribe={transcribeAudio}
					composingFor={activeConversationId}
				/>
			</div>

			{/* Drag-to-resize grip on the canvas-facing edge. The detached window
			    is resized by the OS window chrome, not by this grip. */}
			{!isMaximized && !isDetachedView && (
				<div
					className="gz-ai-chat-resize"
					style={resizeHandleStyle}
					onPointerDown={handleResizeStart}
					role="separator"
					aria-orientation="vertical"
					title={t('AI_ASSISTANT.RESIZE', 'Drag to resize')}
					aria-label={t('AI_ASSISTANT.RESIZE', 'Drag to resize')}
				/>
			)}
		</div>
	);
}
