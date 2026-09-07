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
import {
	AI_CHAT_RATE_LIMIT_CODE,
	AI_CHAT_SETTINGS_PATH,
	PermissionsEnum,
	type IAiChatRateLimitEnvelope,
	type IAiSpeechErrorBody
} from '@gauzy/contracts';
import { environment } from '@gauzy/ui-config';
import { executeClientTool, isClientTool } from '../chat-client-tools';
import { useAngularSignal } from '../use-angular-signal';
import { useChatTranslate } from '../use-chat-translate';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput, DictationError } from './ChatInput';
import { ChatWelcome } from './ChatWelcome';
import { ChatHistoryPanel, type IChatHistoryItem } from './ChatHistoryPanel';
import { DocsAttachPicker } from './DocsAttachPicker';
import { buildAttachmentPreamble, type IStagedAttachment } from './attachment-preamble';
import { chatTheme } from '../chat-theme';
import { chatMarkdownCss } from '../chat-markdown-css';

/**
 * What the docs upload endpoint answers with (the slice this panel reads).
 * Mirrored rather than imported: `IDocumentUploadResponse` lives in the backend docs plugin,
 * which must not be pulled into the browser bundle.
 */
interface IDocsUploadResponseSlice {
	results?: { document?: { id?: string; name?: string; kind?: string } }[];
	rejected?: { fileName?: string; message?: string }[];
	message?: string;
}

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

	// Attachments staged for the NEXT message: a picked Documents entry carries its id (so
	// `docs_read` can open exactly that one), an uploaded file only its name (the capture into
	// Documents is asynchronous, so no id exists yet when the upload returns).
	const [attachments, setAttachments] = useState<IStagedAttachment[]>([]);
	const [showAttachPicker, setShowAttachPicker] = useState(false);
	const [isAttaching, setIsAttaching] = useState(false);
	const [attachmentError, setAttachmentError] = useState<string | null>(null);

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
	 * The tenant/organization scope the Documents endpoints require IN THE REQUEST ITSELF —
	 * `where[organizationId]` on the list, an `organizationId` part in the upload body. The
	 * Tenant-Id/Organization-Id HEADERS do not satisfy those DTO validators
	 * (`TenantOrganizationBaseDTO`), which is exactly how the picker first shipped broken:
	 * every request answered 400 and the UI misread it as "Documents unavailable".
	 */
	const attachScope = useCallback(
		(): { organizationId?: string; tenantId?: string } => ({
			...(store.organizationId ? { organizationId: store.organizationId } : {}),
			...(store.tenantId ? { tenantId: store.tenantId } : {})
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
	 *
	 * A failure throws a {@link DictationError} carrying the server's `code` and `settingsPath` (a
	 * 503 body is `{ message, code, settingsPath }`), so the input can render an actionable,
	 * translated message with a link to the AI Providers page instead of the raw server sentence.
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
				// rejected key — so it is worth more to the user than a status code; the code is what
				// lets the UI say WHERE to fix it.
				const body = await response
					.json()
					.then((parsed: Partial<IAiSpeechErrorBody> | null) => parsed ?? {})
					.catch(() => ({}) as Partial<IAiSpeechErrorBody>);
				const message =
					typeof body.message === 'string' && body.message.trim()
						? body.message
						: `Transcription failed (HTTP ${response.status})`;
				throw new DictationError(message, {
					code: typeof body.code === 'string' ? body.code : undefined,
					settingsPath: typeof body.settingsPath === 'string' ? body.settingsPath : undefined,
					status: response.status
				});
			}
			const body = (await response.json()) as { text?: string };
			return body.text ?? '';
		},
		[authHeaders]
	);

	/**
	 * Open the AI Providers settings page from a dictation error, when this user may.
	 *
	 * Passed to the input as `onOpenAiSettings` ONLY when the user holds `AI_CHAT_SETTINGS` — the
	 * input then shows an "Open AI Providers" action; without it, the message tells the user to ask
	 * an administrator instead of offering a link that would bounce them to the settings index.
	 */
	const openAiSettings = useCallback(
		(settingsPath?: string) => {
			void injector
				.get(AgentPageBridgeService)
				.openPage(settingsPath || AI_CHAT_SETTINGS_PATH)
				.catch(() => undefined);
		},
		[injector]
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
			// Attachments ride along as a plain preamble rather than as a hidden channel: the
			// assistant's `docs_read` tool takes a document id, so naming the ids in the turn is
			// what lets it actually open what the user attached. Cleared on send — an attachment
			// belongs to the message it was attached to, not to the conversation.
			const preamble = buildAttachmentPreamble(attachments);
			setAttachments([]);
			void sendMessage({ text: preamble ? `${preamble}\n\n${text}` : text });
		},
		[attachments, input, isBusy, sendMessage]
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

	/**
	 * Open a Documents citation chip.
	 *
	 * Routed through `AgentPageBridgeService` (the same bridge the `open_page` canvas tool uses)
	 * rather than through an `<a href>`: the citation url is an in-app path, so navigating with
	 * the Angular router keeps the SPA — and this chat panel with its in-flight turn — alive.
	 */
	const handleOpenCitation = useCallback(
		(citation: { url?: string }) => {
			if (!citation?.url) return;
			void injector
				.get(AgentPageBridgeService)
				.openPage(citation.url)
				.catch(() => undefined);
		},
		[injector]
	);

	/**
	 * Upload a file the user picked and attach it to this conversation — ID FIRST.
	 *
	 * The upload goes straight to the Documents feature (`source: CHAT`), which answers
	 * synchronously with the created document — so the chip carries a `documentId` and the
	 * assistant can `docs_read` the file in the very message it was attached to. The previous
	 * design uploaded to chat-local storage and relied on the Documents plugin capturing an
	 * event LATER: the chip was name-only, and the preamble sent the assistant to `docs_search`
	 * — which can never find a chat capture (they are deliberately never auto-indexed), and a
	 * file the sniffer rejected got a chip anyway while the capture silently dropped it.
	 *
	 * The chat-local endpoint remains as the FALLBACK for installs where Documents is absent,
	 * disabled, or the user lacks `DOCS_CREATE` (403/404 from the docs route) — there the docs
	 * tools do not exist either, so a name-only mention is the honest ceiling.
	 *
	 * `FormData` deliberately WITHOUT a Content-Type header — the browser has to set it, because
	 * only it knows the multipart boundary (the same rule as dictation above).
	 */
	const handleAttachFile = useCallback(
		async (file: File): Promise<void> => {
			setIsAttaching(true);
			setAttachmentError(null);
			try {
				const docsForm = new FormData();
				docsForm.append('files', file, file.name);
				docsForm.append('source', 'CHAT');
				// Required by UploadDocumentsDTO (TenantOrganizationBaseDTO): the org must be in the
				// BODY — headers alone fail validation with "organizationId must be a UUID".
				const scope = attachScope();
				if (scope.organizationId) docsForm.append('organizationId', scope.organizationId);
				if (scope.tenantId) docsForm.append('tenantId', scope.tenantId);
				const docsResponse = await fetch(`${environment.API_BASE_URL}/api/plugins/docs/documents/upload`, {
					method: 'POST',
					headers: authHeaders(),
					body: docsForm
				});

				if (docsResponse.ok) {
					const body = (await docsResponse.json().catch(() => null)) as IDocsUploadResponseSlice | null;
					const document = body?.results?.[0]?.document;
					if (document?.id) {
						setAttachments((current) => [
							...current,
							{
								documentId: document.id,
								name: document.name || file.name,
								...(document.kind === 'PAGE' ? { kind: 'PAGE' as const } : {})
							}
						]);
						return;
					}
					// Three distinct 2xx outcomes, told apart so the user is never told "rejected"
					// about a file the server may in fact have created:
					// a genuine per-file rejection carries the server's reason; a body that did not
					// parse, or one with no readable document id, is a response-shape problem — the
					// document may exist, so point at the Documents page rather than blaming the file.
					const rejection = body?.rejected?.[0];
					if (rejection) {
						throw new Error(
							rejection.message || `${t('AI_ASSISTANT.ATTACH_REJECTED', 'The file was rejected')}: ${file.name}`
						);
					}
					throw new Error(
						`${t(
							'AI_ASSISTANT.ATTACH_RESPONSE_UNREADABLE',
							'The upload response could not be read — check the Documents page before retrying'
						)}: ${file.name}`
					);
				}

				// Not-found / forbidden = the Documents feature is not available to this user or
				// install — fall back to chat-local storage. Anything else is a real failure.
				if (docsResponse.status !== 403 && docsResponse.status !== 404) {
					const detail = await docsResponse
						.json()
						.then((body: { message?: string }) => body?.message)
						.catch(() => undefined);
					throw new Error(detail || `Attachment failed (HTTP ${docsResponse.status})`);
				}

				const form = new FormData();
				form.append('file', file, file.name);
				if (conversationIdRef.current) {
					form.append('conversationId', conversationIdRef.current);
				}
				const response = await fetch(`${environment.API_BASE_URL}/api/ai-chat/attachments`, {
					method: 'POST',
					headers: authHeaders(),
					body: form
				});
				if (!response.ok) {
					const detail = await response
						.json()
						.then((body: { message?: string }) => body?.message)
						.catch(() => undefined);
					throw new Error(detail || `Attachment failed (HTTP ${response.status})`);
				}
				const saved = (await response.json()) as { name?: string };
				setAttachments((current) => [...current, { name: saved?.name || file.name }]);
			} catch (attachError) {
				setAttachmentError(attachError instanceof Error ? attachError.message : String(attachError));
			} finally {
				setIsAttaching(false);
			}
		},
		[authHeaders, attachScope]
	);

	/** Attach an existing document by id — what makes `docs_read` able to open exactly that one. */
	const handlePickDocument = useCallback((document: { id: string; name: string; kind?: string }) => {
		setAttachments((current) => [
			...current,
			{
				documentId: document.id,
				name: document.name,
				// Carried so the chip (and the one rebuilt from history) links a PAGE to its page
				// editor route rather than the file browser.
				...(document.kind === 'PAGE' ? { kind: 'PAGE' as const } : {})
			}
		]);
		setShowAttachPicker(false);
	}, []);

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
		padding: '10px 10px 10px 13px',
		borderBottom: `1px solid ${chatTheme.border}`,
		flexShrink: 0,
		color: chatTheme.textPrimary,
		fontSize: chatTheme.fontSizeBase,
		fontWeight: chatTheme.fontWeightSemibold,
		letterSpacing: '-0.005em',
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
		borderRadius: chatTheme.controlRadius,
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
		gap: 5,
		padding: '0 8px',
		fontFamily: 'inherit',
		fontSize: '0.6875rem',
		fontWeight: chatTheme.fontWeightMedium,
		letterSpacing: '0.01em',
		whiteSpace: 'nowrap'
	};

	const bodyStyle: CSSProperties = {
		flex: 1,
		display: 'flex',
		flexDirection: 'column',
		overflow: 'hidden',
		minWidth: 0,
		// The positioning context for the history and attach-picker overlays: `inset: 0` must
		// resolve against the BODY, so an overlay can never cover the panel's own header row.
		position: 'relative'
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
			{/* Keyframes, the shared markdown sheet, and every state inline styles
			    cannot express (hover, focus, ::placeholder). Wide streamed content
			    (code blocks, tables) scrolls inside its own box here rather than
			    stretching the narrow panel and squeezing the input row. */}
			<style>{`
				@keyframes fadeIn {
					from { opacity: 0; transform: translateY(4px); }
					to { opacity: 1; transform: translateY(0); }
				}
				@keyframes typingDot {
					0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
					40% { transform: scale(1); opacity: 1; }
				}

				${chatMarkdownCss}

				/* Tool steps. The row is the expander, so the label carries the affordance:
				   accent coloured, underlined on hover, like every other link here. */
				.gz-ai-chat-tool-label { transition: color ${chatTheme.transitionSpeed} ease; }
				.gz-ai-chat-tool-row:hover .gz-ai-chat-tool-label { text-decoration: underline; }
				.gz-ai-chat-tool-row:focus-visible {
					outline: 2px solid rgba(51, 102, 255, 0.6);
					outline-offset: 2px;
					border-radius: 4px;
				}

				/* Attachment chips on a user message. */
				.gz-ai-chat-user-chip { transition: background-color ${chatTheme.transitionSpeed} ease; }
				.gz-ai-chat-user-chip:hover { background-color: rgba(255, 255, 255, 0.26) !important; }

				/* ── Composer ─────────────────────────────────────────────────────
				   The placeholder tone and every hover/focus state live here: inline
				   styles can express neither, so the composer read as flat and inert. */
				.gz-ai-chat-textarea::placeholder {
					color: ${chatTheme.inputPlaceholder};
					opacity: 1;
				}
				.gz-ai-chat-tool-btn {
					transition: background-color ${chatTheme.transitionSpeed} ease, color ${chatTheme.transitionSpeed} ease;
				}
				.gz-ai-chat-tool-btn:hover:not(:disabled):not([aria-disabled='true']):not([aria-pressed='true']) {
					background-color: color-mix(in srgb, currentColor 10%, transparent) !important;
					color: inherit !important;
				}
				.gz-ai-chat-tool-btn:focus-visible,
				.gz-ai-chat-send-btn:focus-visible {
					outline: 2px solid rgba(51, 102, 255, 0.6);
					outline-offset: 2px;
				}
				.gz-ai-chat-send-btn {
					transition: background-color ${chatTheme.transitionSpeed} ease, transform ${chatTheme.transitionSpeed} ease,
						filter ${chatTheme.transitionSpeed} ease, opacity ${chatTheme.transitionSpeed} ease;
				}
				.gz-ai-chat-send-btn:hover:not(:disabled) { transform: scale(1.05); filter: brightness(1.08); }
				.gz-ai-chat-send-btn:active:not(:disabled) { transform: scale(0.96); }
				.gz-ai-chat-send-btn:disabled { cursor: default; }

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

			{/* Chat body — fills remaining height. The overlays mount INSIDE it so they cover the
			    conversation area only, never the panel's own header (which stays operable — the
			    user can still collapse/detach while a picker is open). */}
			<div style={bodyStyle}>
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

				{/* "Attach from Documents" overlay */}
				{showAttachPicker && (
					<DocsAttachPicker
						apiBaseUrl={environment.API_BASE_URL}
						headers={authHeaders}
						scope={attachScope}
						translate={t}
						onPick={handlePickDocument}
						onClose={() => setShowAttachPicker(false)}
					/>
				)}
				{hasMessages ? (
					<ChatMessageList
						messages={messages}
						status={status}
						onApprovalResponse={handleApprovalResponse}
						onOpenCitation={handleOpenCitation}
						translate={t}
					/>
				) : (
					<ChatWelcome translate={t} />
				)}

				{/* Error bar */}
				{error && (
					<div
						style={{
							padding: '8px 12px',
							backgroundColor: 'rgba(255, 61, 113, 0.12)',
							color: chatTheme.red,
							fontSize: chatTheme.fontSizeSmall,
							lineHeight: 1.5,
							borderTop: `1px solid ${chatTheme.border}`,
							display: 'flex',
							alignItems: 'center',
							gap: 7
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
								fontWeight: chatTheme.fontWeightMedium,
								fontFamily: 'inherit',
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
				{/* Staged attachments — removable until the message is sent. */}
				{(attachments.length > 0 || attachmentError) && (
					<div
						style={{
							display: 'flex',
							flexWrap: 'wrap',
							alignItems: 'center',
							gap: 5,
							padding: '10px 12px 0'
						}}
					>
						{attachments.map((attachment, index) => (
							<span
								key={`${attachment.documentId ?? attachment.name}-${index}`}
								style={{
									display: 'inline-flex',
									alignItems: 'center',
									gap: 5,
									maxWidth: '100%',
									padding: '4px 9px',
									borderRadius: 999,
									border: `1px solid ${chatTheme.border}`,
									backgroundColor: chatTheme.surface,
									color: chatTheme.textPrimary,
									fontSize: chatTheme.fontSizeMessage,
									fontWeight: chatTheme.fontWeightMedium,
									lineHeight: 1.5
								}}
							>
								<span aria-hidden="true">📎</span>
								<span
									style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
									title={attachment.name}
								>
									{attachment.name}
								</span>
								<button
									type="button"
									onClick={() =>
										setAttachments((current) =>
											current.filter((_entry, entryIndex) => entryIndex !== index)
										)
									}
									aria-label={`${t('AI_ASSISTANT.ATTACH_REMOVE', 'Remove attachment')}: ${attachment.name}`}
									style={{
										background: 'none',
										border: 'none',
										color: chatTheme.textSecondary,
										cursor: 'pointer',
										padding: 0,
										lineHeight: 1
									}}
								>
									×
								</button>
							</span>
						))}
						{attachmentError && (
							<span
								style={{
									color: chatTheme.red,
									fontSize: chatTheme.fontSizeSmall,
									lineHeight: 1.5
								}}
							>
								{attachmentError}
							</span>
						)}
					</div>
				)}

				<ChatInput
					value={input}
					isBusy={isBusy}
					translate={t}
					onChange={setInput}
					onSubmit={handleSubmit}
					onStop={() => void stop()}
					onEscape={isDetachedView ? undefined : handleCollapse}
					onTranscribe={transcribeAudio}
					onOpenAiSettings={canOpenAiSettings() ? openAiSettings : undefined}
					onAttachFile={handleAttachFile}
					onAttachFromDocuments={() => {
						setAttachmentError(null);
						setShowAttachPicker(true);
					}}
					isAttaching={isAttaching}
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
