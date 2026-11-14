import { HttpClient } from '@angular/common/http';
import { inject, Injectable, Injector } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import {
	CHAT_EVENT_NAMES,
	ChatMemberRoleEnum,
	ChatNotifyLevelEnum,
	DocumentSourceEnum,
	DocumentVisibilityEnum,
	IChatCategory,
	IChatCategoryInput,
	IChatCategoryReorderInput,
	IChatCategoryReorderResult,
	IChatConversationCreateInput,
	IChatConversationList,
	IChatConversationUpdateInput,
	IChatConversationWithState,
	IChatCreateTaskInput,
	IChatCreateTaskResult,
	IChatDraftDiscardResult,
	IChatEvent,
	IChatFilesQuery,
	IChatFilesResult,
	IChatLinkPreview,
	IChatMemberState,
	IChatMemberStateInput,
	IChatMemberSummary,
	IChatMessageCreateInput,
	IChatMessagePage,
	IChatMessagesQuery,
	IChatMessageUpdateInput,
	IChatMessageWithRelations,
	IChatReadAllResult,
	IChatSendResult,
	IChatStates,
	IChatTaskUpdateInput,
	IChatTaskUpdateResult,
	IChatTypingInput,
	IChatTypingResult,
	ID
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';
import { ChatTeam } from '../chat-team-suggestions';
import { typingRefusalOf } from '../chat-typing';
import { CHAT_PAGE_SIZE } from '../chat-ui.constants';

const CHAT = `${API_PREFIX}/chat`;
const path = (id: ID) => encodeURIComponent(String(id));

/** What a write answers besides its record: the events it caused. */
export type ChatEvents = { events: IChatEvent[] };
type ConversationAnswer = { conversation: IChatConversationWithState } & ChatEvents;

/** A thread: its root message and a page of its replies. */
export type ChatThreadPage = IChatMessagePage & { root: IChatMessageWithRelations };

/** A followed thread's root, with how many of its replies I have not read. */
export type ChatFollowedThread = IChatMessageWithRelations & { unreadReplies: number };

/**
 * A change to a message the page passes around: the id of the message it belongs to and the fields that changed.
 * The id is optional in the contract (`IBaseEntityModel`), so a whole message the API answered is a patch too.
 */
export type ChatMessagePatch = Partial<IChatMessageWithRelations>;

/** The fields of a message that its thread moves: the reply count, the last reply, whether I follow it. */
export function threadFieldsOf(message: IChatMessageWithRelations): ChatMessagePatch {
	return { id: message.id, replyCount: message.replyCount, lastReplyAt: message.lastReplyAt, following: message.following };
}

/** A person chat shows (`GET /chat/people`): an active employee with the name and picture any chat user may see. */
export interface ChatPersonRecord {
	employeeId: ID;
	userId: ID;
	name: string;
	imageUrl: string | null;
	/** Their position in the organization, when the API sends one. */
	position?: string | null;
	/** Their presence when the list was read (`active`, `idle`, `offline`), when the API sends it. */
	presence?: string | null;
	/** When one of their tabs last reported, when the API sends it. */
	lastSeenAt?: string | Date | null;
}

/**
 * What the Docs plugin answers an upload (`POST /api/plugins/docs/documents/upload`): the documents it stored, and
 * the files it refused with why. Only the members chat reads are named here.
 */
export interface ChatUploadAnswer {
	results: Array<{ document: { id: ID; name?: string | null; mimeType?: string | null; fileSize?: number | null } }>;
	rejected: Array<{ fileName: string; code: string; message: string }>;
}

/** Where the Docs plugin takes uploads: every attachment is a FILE document of its uploader. */
export const CHAT_UPLOAD_URL = `${API_PREFIX}/plugins/docs/documents/upload`;

/** What `chat_member.state_changed` carries. */
interface MemberStateChangedData {
	conversationId?: ID;
	readCount?: number;
	mentionCount?: number;
	notifyLevel?: IChatMemberState['notifyLevel'];
	isFavorite?: boolean;
	lastReadMessageId?: ID | null;
}

/**
 * My state of a conversation after the events a write answered: the member-state fact of that conversation,
 * applied over the state I had (the role stays; the unread count is the message count minus what I read).
 */
export function memberStateFromEvents(
	events: readonly IChatEvent[] | undefined,
	conversation: Pick<IChatConversationWithState, 'id' | 'messageCount'>,
	current: IChatMemberState | null
): IChatMemberState | null {
	const fact = (events ?? []).find(
		(event) => event.name === CHAT_EVENT_NAMES.MEMBER_STATE_CHANGED && String((event.data as MemberStateChangedData)?.conversationId) === String(conversation.id)
	);
	if (!fact) return current;
	const data = fact.data as MemberStateChangedData;
	const readCount = Number(data.readCount ?? 0);
	return {
		conversationId: conversation.id,
		role: current?.role ?? ChatMemberRoleEnum.MEMBER,
		notifyLevel: data.notifyLevel ?? current?.notifyLevel ?? ChatNotifyLevelEnum.ALL,
		isFavorite: data.isFavorite ?? current?.isFavorite ?? false,
		unreadCount: Math.max(0, (conversation.messageCount ?? 0) - readCount),
		mentionCount: Number(data.mentionCount ?? 0),
		lastReadMessageId: data.lastReadMessageId ?? current?.lastReadMessageId ?? null,
		lastReadAt: current?.lastReadAt ?? null
	};
}

/**
 * The chat routes of the API (`@gauzy/plugin-chat`, `/api/chat/*`). They exist only where the API loads the
 * plugin (`FEATURE_CHAT` on): elsewhere every call answers 404. The caller is always the signed-in employee,
 * taken by the API from the credential. Every write answers the events it caused, so the page applies them at once.
 */
@Injectable({ providedIn: 'root' })
export class ChatUiService {
	private readonly http = inject(HttpClient);
	/** Reaches the session's store only when a file is uploaded (the one call that names the organization itself). */
	private readonly injector = inject(Injector);
	/** The platform has no typing route: the composer stops asking (for the page). */
	private typingOff = false;
	/** The places (`conversation:thread`) that refused a typing signal. */
	private readonly typingRefused = new Set<string>();
	private readonly changes = new Subject<void>();

	/** Emits when the page changed my state (read, sent, joined), so the badge counts again at once. */
	readonly changed$: Observable<void> = this.changes.asObservable();

	notifyChanged(): void {
		this.changes.next();
	}

	// ---------------------------------------------------------------- people and conversations

	/** The active employees of my organization with name and picture (what chat shows and suggests). */
	people(): Observable<ChatPersonRecord[]> {
		return this.http.get<ChatPersonRecord[]>(`${CHAT}/people`);
	}

	/**
	 * The organization's teams (`GET /organization-team`, which needs `ORG_TEAM_VIEW`; archived teams are left out),
	 * as their ids and names: the new-channel dialog suggests them as channel names.
	 */
	teams(organizationId: ID, tenantId: ID): Observable<ChatTeam[]> {
		return this.http
			.get<{ items?: Array<{ id?: ID; name?: string | null }> }>(`${API_PREFIX}/organization-team`, {
				params: toParams({ where: { organizationId, tenantId } })
			})
			.pipe(
				map((page) =>
					(page?.items ?? []).filter((team) => !!team?.id && !!team?.name?.trim()).map((team) => ({ id: String(team.id), name: String(team.name).trim() }))
				)
			);
	}

	listMine(): Observable<IChatConversationList> {
		return this.http.get<IChatConversationList>(`${CHAT}/conversations`);
	}

	browse(): Observable<IChatConversationWithState[]> {
		return this.http.get<IChatConversationWithState[]>(`${CHAT}/conversations/browse`);
	}

	/** My state of every conversation, and the followed threads with unread replies (the badge). */
	states(): Observable<IChatStates> {
		return this.http.get<IChatStates>(`${CHAT}/states`);
	}

	getConversation(id: ID): Observable<IChatConversationWithState> {
		return this.http.get<IChatConversationWithState>(`${CHAT}/conversations/${path(id)}`);
	}

	createChannel(input: IChatConversationCreateInput): Observable<ConversationAnswer> {
		return this.http.post<ConversationAnswer>(`${CHAT}/conversations`, input);
	}

	updateConversation(id: ID, input: IChatConversationUpdateInput): Observable<ConversationAnswer> {
		return this.http.patch<ConversationAnswer>(`${CHAT}/conversations/${path(id)}`, input);
	}

	/** Finds or creates the direct (two people) or group conversation of these employees and me. */
	direct(employeeIds: ID[]): Observable<ConversationAnswer & { created: boolean }> {
		return this.http.post<ConversationAnswer & { created: boolean }>(`${CHAT}/direct`, { employeeIds });
	}

	setArchived(id: ID, archived: boolean): Observable<ConversationAnswer> {
		return this.http.post<ConversationAnswer>(`${CHAT}/conversations/${path(id)}/${archived ? 'archive' : 'unarchive'}`, {});
	}

	join(id: ID): Observable<ConversationAnswer> {
		return this.http.post<ConversationAnswer>(`${CHAT}/conversations/${path(id)}/join`, {});
	}

	leave(id: ID): Observable<ChatEvents> {
		return this.http.post<ChatEvents>(`${CHAT}/conversations/${path(id)}/leave`, {});
	}

	members(id: ID): Observable<IChatMemberSummary[]> {
		return this.http.get<IChatMemberSummary[]>(`${CHAT}/conversations/${path(id)}/members`);
	}

	addMembers(id: ID, employeeIds: ID[]): Observable<{ members: IChatMemberSummary[] } & ChatEvents> {
		return this.http.post<{ members: IChatMemberSummary[] } & ChatEvents>(`${CHAT}/conversations/${path(id)}/members`, { employeeIds });
	}

	removeMember(id: ID, employeeId: ID): Observable<ChatEvents> {
		return this.http.delete<ChatEvents>(`${CHAT}/conversations/${path(id)}/members/${path(employeeId)}`);
	}

	/** My notify level and favourite flag of a conversation. */
	setState(id: ID, input: IChatMemberStateInput): Observable<{ state: IChatMemberState } & ChatEvents> {
		return this.http.patch<{ state: IChatMemberState } & ChatEvents>(`${CHAT}/conversations/${path(id)}/state`, input);
	}

	categories(): Observable<IChatCategory[]> {
		return this.http.get<IChatCategory[]>(`${CHAT}/categories`);
	}

	/** A sidebar category (`CHAT_MANAGE`). */
	createCategory(input: IChatCategoryInput): Observable<IChatCategory> {
		return this.http.post<IChatCategory>(`${CHAT}/categories`, input);
	}

	/** Renames or moves a category (`CHAT_MANAGE`). */
	updateCategory(id: ID, input: Partial<IChatCategoryInput>): Observable<IChatCategory> {
		return this.http.patch<IChatCategory>(`${CHAT}/categories/${path(id)}`, input);
	}

	/** Saves the order of the categories (and of the channels within them) in one call (`CHAT_MANAGE`). */
	reorderCategories(input: IChatCategoryReorderInput): Observable<IChatCategoryReorderResult> {
		return this.http.post<IChatCategoryReorderResult>(`${CHAT}/categories/reorder`, input);
	}

	/** Deletes a category; its channels stay, uncategorized (`CHAT_MANAGE`). */
	deleteCategory(id: ID): Observable<void> {
		return this.http.delete<void>(`${CHAT}/categories/${path(id)}`);
	}

	// ---------------------------------------------------------------- messages

	messages(conversationId: ID, query: IChatMessagesQuery = {}): Observable<IChatMessagePage> {
		return this.http.get<IChatMessagePage>(`${CHAT}/conversations/${path(conversationId)}/messages`, {
			params: toParams({ ...query, limit: query.limit ?? CHAT_PAGE_SIZE })
		});
	}

	pins(conversationId: ID): Observable<IChatMessageWithRelations[]> {
		return this.http.get<IChatMessageWithRelations[]>(`${CHAT}/conversations/${path(conversationId)}/pins`);
	}

	send(conversationId: ID, input: IChatMessageCreateInput): Observable<IChatSendResult> {
		return this.http.post<IChatSendResult>(`${CHAT}/conversations/${path(conversationId)}/messages`, input);
	}

	edit(messageId: ID, input: IChatMessageUpdateInput): Observable<IChatSendResult> {
		return this.http.patch<IChatSendResult>(`${CHAT}/messages/${path(messageId)}`, input);
	}

	remove(messageId: ID): Observable<ChatEvents> {
		return this.http.delete<ChatEvents>(`${CHAT}/messages/${path(messageId)}`);
	}

	setPinned(messageId: ID, pinned: boolean): Observable<IChatSendResult> {
		return this.http.post<IChatSendResult>(`${CHAT}/messages/${path(messageId)}/${pinned ? 'pin' : 'unpin'}`, {});
	}

	/** Marks the conversation unread from this message on; the answer's events carry my new state. */
	unreadFrom(messageId: ID): Observable<ChatEvents> {
		return this.http.post<ChatEvents>(`${CHAT}/messages/${path(messageId)}/unread`, {});
	}

	/** Creates a task from a message (`ORG_TASK_ADD` too); the message keeps a reference to it. */
	createTask(messageId: ID, input: IChatCreateTaskInput): Observable<IChatCreateTaskResult> {
		return this.http.post<IChatCreateTaskResult>(`${CHAT}/messages/${path(messageId)}/create-task`, input);
	}

	/**
	 * Changes a task from its card in a message (status, priority, assignees): the platform's task update, with the
	 * task page's permission (`ORG_TASK_EDIT`) and activity log.
	 */
	updateTask(messageId: ID, taskId: ID, input: IChatTaskUpdateInput): Observable<IChatTaskUpdateResult> {
		return this.http.patch<IChatTaskUpdateResult>(`${CHAT}/messages/${path(messageId)}/tasks/${path(taskId)}`, input);
	}

	/** Tells the other members that I am typing here (or in a thread); nothing is stored. */
	typing(conversationId: ID, input: IChatTypingInput = {}): Observable<IChatTypingResult> {
		return this.http.post<IChatTypingResult>(`${CHAT}/conversations/${path(conversationId)}/typing`, input);
	}

	/**
	 * The composer's "I am typing" (best effort; nothing waits on it). A place that refuses it (not a member, archived)
	 * is not asked again; a platform without the route is not asked again for the page.
	 */
	signalTyping(conversationId: ID, threadRootId: ID | null = null): void {
		const place = `${conversationId}:${threadRootId ?? ''}`;
		if (this.typingOff || this.typingRefused.has(place)) return;
		this.typing(conversationId, threadRootId ? { threadRootId } : {}).subscribe({
			error: (error: unknown) => {
				const refusal = typingRefusalOf(error);
				if (refusal === 'route') this.typingOff = true;
				else if (refusal === 'place') this.typingRefused.add(place);
			}
		});
	}

	/** Discards a file I uploaded for a message and will not send (its document and stored bytes go). */
	discardAttachment(documentId: ID): Observable<IChatDraftDiscardResult> {
		return this.http.delete<IChatDraftDiscardResult>(`${CHAT}/attachments/${path(documentId)}`);
	}

	react(messageId: ID, emoji: string, on: boolean): Observable<IChatSendResult> {
		const url = `${CHAT}/messages/${path(messageId)}/reactions/${encodeURIComponent(emoji)}`;
		return on ? this.http.post<IChatSendResult>(url, {}) : this.http.delete<IChatSendResult>(url);
	}

	// ---------------------------------------------------------------- link previews

	/**
	 * The preview of a link, which the platform fetches and caches (`ready`, `pending`: ask again in a moment, or
	 * `unavailable`). Answers 404 while the platform's link previews are off.
	 */
	linkPreview(url: string): Observable<IChatLinkPreview> {
		return this.http.get<IChatLinkPreview>(`${CHAT}/link-preview`, { params: toParams({ url }) });
	}

	/**
	 * The picture of a link's preview, served by the platform from its own fetch (so the browser never loads it from the
	 * linked site). Answers 404 while the platform serves no pictures, and for a link with no ready preview or picture.
	 */
	linkPreviewImage(url: string): Observable<Blob> {
		return this.http.get(`${CHAT}/link-preview/image`, { params: toParams({ url }), responseType: 'blob' });
	}

	// ---------------------------------------------------------------- files

	/** The files of a conversation (what its messages carry), newest first. */
	files(conversationId: ID, query: IChatFilesQuery = {}): Observable<IChatFilesResult> {
		return this.http.get<IChatFilesResult>(`${CHAT}/conversations/${path(conversationId)}/files`, { params: toParams({ ...query }) });
	}

	/**
	 * The bytes of a stored file, read through the Docs plugin as the signed-in person (the way the Documents page
	 * shows a file): for a picture whose own address the browser cannot load. Answers 404 for a file the person may
	 * not read there.
	 */
	fileBytes(documentId: ID): Observable<Blob> {
		return this.http.get(`${API_PREFIX}/plugins/docs/documents/${path(documentId)}/raw`, { responseType: 'blob' });
	}

	/**
	 * Stores one file to attach through the Docs plugin: a private FILE document of the sender, marked as coming from
	 * the chat, kept out of the knowledge base and of the AI classification. The members of the conversation reach it
	 * through the conversation's files (membership-checked), never through the document's own visibility.
	 */
	uploadFile(file: File): Observable<ChatUploadAnswer> {
		const form = new FormData();
		form.append('files', file, file.name);
		// The Docs upload names its organization in the form (it answers 400 without one): the one selected here.
		const organizationId = this.injector.get(Store, null)?.selectedOrganization?.id;
		if (organizationId) form.append('organizationId', String(organizationId));
		form.append('visibility', DocumentVisibilityEnum.PRIVATE);
		form.append('source', DocumentSourceEnum.CHAT);
		form.append('importToKnowledge', 'false');
		form.append('classifyWithAi', 'false');
		return this.http.post<ChatUploadAnswer>(CHAT_UPLOAD_URL, form);
	}

	// ---------------------------------------------------------------- threads and read state

	thread(rootMessageId: ID, query: IChatMessagesQuery = {}): Observable<ChatThreadPage> {
		return this.http.get<ChatThreadPage>(`${CHAT}/messages/${path(rootMessageId)}/thread`, {
			params: toParams({ ...query, limit: query.limit ?? CHAT_PAGE_SIZE })
		});
	}

	setFollowing(rootMessageId: ID, following: boolean): Observable<ChatEvents> {
		return this.http.post<ChatEvents>(`${CHAT}/messages/${path(rootMessageId)}/${following ? 'follow' : 'unfollow'}`, {});
	}

	/** Marks a thread I follow read (its unread replies go to zero). */
	markThreadRead(rootMessageId: ID): Observable<{ updated: boolean }> {
		return this.http.post<{ updated: boolean }>(`${CHAT}/messages/${path(rootMessageId)}/thread/read`, {});
	}

	/** My followed threads. */
	threads(): Observable<ChatFollowedThread[]> {
		return this.http.get<ChatFollowedThread[]>(`${CHAT}/threads`);
	}

	/** Marks a conversation read up to a message (without one: everything, followed threads included); the events carry my state. */
	read(conversationId: ID, messageId?: ID): Observable<ChatEvents> {
		return this.http.post<ChatEvents>(`${CHAT}/conversations/${path(conversationId)}/read`, messageId ? { messageId } : {});
	}

	readAll(): Observable<IChatReadAllResult> {
		return this.http.post<IChatReadAllResult>(`${CHAT}/read-all`, {});
	}

	/** Undoes a mark-all-read within a minute. */
	readRestore(snapshotId: string): Observable<{ restored: number } & ChatEvents> {
		return this.http.post<{ restored: number } & ChatEvents>(`${CHAT}/read-restore`, { snapshotId });
	}
}
