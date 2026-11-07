import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import {
	IChatCategory,
	IChatConversationCreateInput,
	IChatConversationList,
	IChatConversationUpdateInput,
	IChatConversationWithState,
	IChatEvent,
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
	ID
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { CHAT_PAGE_SIZE } from '../chat-ui.constants';

const CHAT = `${API_PREFIX}/chat`;
const path = (id: ID) => encodeURIComponent(String(id));

type Events = { events: IChatEvent[] };
type ConversationAnswer = { conversation: IChatConversationWithState } & Events;

/** A thread: its root message and a page of its replies. */
export type ChatThreadPage = IChatMessagePage & { root: IChatMessageWithRelations };

/** A followed thread's root, with how many of its replies I have not read. */
export type ChatFollowedThread = IChatMessageWithRelations & { unreadReplies: number };

/**
 * The chat routes of the API (`@gauzy/plugin-chat`, `/api/chat/*`). They exist only where the API loads the
 * plugin (`FEATURE_CHAT` on): elsewhere every call answers 404. The caller is always the signed-in employee,
 * taken by the API from the credential. Every write answers the events it caused, so the page applies them at once.
 */
@Injectable({ providedIn: 'root' })
export class ChatUiService {
	private readonly http = inject(HttpClient);
	private readonly changes = new Subject<void>();

	/** Emits when the page changed my state (read, sent, joined), so the badge counts again at once. */
	readonly changed$: Observable<void> = this.changes.asObservable();

	notifyChanged(): void {
		this.changes.next();
	}

	// ---------------------------------------------------------------- conversations

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

	leave(id: ID): Observable<Events> {
		return this.http.post<Events>(`${CHAT}/conversations/${path(id)}/leave`, {});
	}

	members(id: ID): Observable<IChatMemberSummary[]> {
		return this.http.get<IChatMemberSummary[]>(`${CHAT}/conversations/${path(id)}/members`);
	}

	addMembers(id: ID, employeeIds: ID[]): Observable<{ members: IChatMemberSummary[] } & Events> {
		return this.http.post<{ members: IChatMemberSummary[] } & Events>(`${CHAT}/conversations/${path(id)}/members`, { employeeIds });
	}

	removeMember(id: ID, employeeId: ID): Observable<Events> {
		return this.http.delete<Events>(`${CHAT}/conversations/${path(id)}/members/${path(employeeId)}`);
	}

	/** My notify level and favourite flag of a conversation. */
	setState(id: ID, input: IChatMemberStateInput): Observable<{ state: IChatMemberState } & Events> {
		return this.http.patch<{ state: IChatMemberState } & Events>(`${CHAT}/conversations/${path(id)}/state`, input);
	}

	categories(): Observable<IChatCategory[]> {
		return this.http.get<IChatCategory[]>(`${CHAT}/categories`);
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

	remove(messageId: ID): Observable<Events> {
		return this.http.delete<Events>(`${CHAT}/messages/${path(messageId)}`);
	}

	setPinned(messageId: ID, pinned: boolean): Observable<IChatSendResult> {
		return this.http.post<IChatSendResult>(`${CHAT}/messages/${path(messageId)}/${pinned ? 'pin' : 'unpin'}`, {});
	}

	/** Marks the conversation unread from this message on. */
	unreadFrom(messageId: ID): Observable<{ state: IChatMemberState } & Events> {
		return this.http.post<{ state: IChatMemberState } & Events>(`${CHAT}/messages/${path(messageId)}/unread`, {});
	}

	react(messageId: ID, emoji: string, on: boolean): Observable<IChatSendResult> {
		const url = `${CHAT}/messages/${path(messageId)}/reactions/${encodeURIComponent(emoji)}`;
		return on ? this.http.post<IChatSendResult>(url, {}) : this.http.delete<IChatSendResult>(url);
	}

	// ---------------------------------------------------------------- threads and read state

	thread(rootMessageId: ID, query: IChatMessagesQuery = {}): Observable<ChatThreadPage> {
		return this.http.get<ChatThreadPage>(`${CHAT}/messages/${path(rootMessageId)}/thread`, {
			params: toParams({ ...query, limit: query.limit ?? CHAT_PAGE_SIZE })
		});
	}

	setFollowing(rootMessageId: ID, following: boolean): Observable<Events> {
		return this.http.post<Events>(`${CHAT}/messages/${path(rootMessageId)}/${following ? 'follow' : 'unfollow'}`, {});
	}

	/** My followed threads. */
	threads(): Observable<ChatFollowedThread[]> {
		return this.http.get<ChatFollowedThread[]>(`${CHAT}/threads`);
	}

	/** Marks a conversation read up to a message (default: everything). */
	read(conversationId: ID, messageId?: ID): Observable<{ state: IChatMemberState } & Events> {
		return this.http.post<{ state: IChatMemberState } & Events>(`${CHAT}/conversations/${path(conversationId)}/read`, messageId ? { messageId } : {});
	}

	readAll(): Observable<IChatReadAllResult> {
		return this.http.post<IChatReadAllResult>(`${CHAT}/read-all`, {});
	}

	/** Undoes a mark-all-read within a minute. */
	readRestore(snapshotId: string): Observable<{ restored: number } & Events> {
		return this.http.post<{ restored: number } & Events>(`${CHAT}/read-restore`, { snapshotId });
	}
}
