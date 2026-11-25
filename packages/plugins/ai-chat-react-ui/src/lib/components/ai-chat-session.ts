import type { SetStateAction } from 'react';
import { Chat } from '@ai-sdk/react';
import type { ChatInit, UIMessage } from 'ai';
import type { IPreviewableAttachment } from './AttachmentPreview';
import type { MessageFeedback } from './MessageActions';

/** A mutable box shaped like a React ref, so the panel can use it exactly like `useRef`. */
interface IBox<T> {
	current: T;
}

/** Files of a message just sent, until it shows up in `messages` with its id. */
export interface IPendingSentFiles {
	text: string;
	files: (File | undefined)[];
}

/**
 * The chat state that must outlive one mounted {@link AiChatPanel}.
 *
 * The docked panel lives inside the `/pages` layout and the full-page chat
 * (`/ai-chat`, Maximize) outside it, so switching between them unmounts one
 * panel and mounts the other. Everything the user would notice losing is
 * therefore kept here rather than in component state:
 * - the AI SDK `Chat` — the messages AND any request in flight, so a reply that
 *   is still streaming keeps streaming into whichever panel is mounted;
 * - the conversation id the backend saves the turns under;
 * - the unsent draft and the staged attachments;
 * - the files sent this session (so their cards still preview from memory).
 *
 * Only the panel's transient UI (an open History list or picker) starts fresh.
 */
export interface IAiChatSession {
	/** The signed-in user the session belongs to — another user never inherits it. */
	readonly ownerId: string | null;
	readonly chat: Chat<UIMessage>;
	readonly conversationIdRef: IBox<string>;
	readonly sentFilesRef: IBox<Map<string, (File | undefined)[]>>;
	readonly pendingSentFilesRef: IBox<IPendingSentFiles | null>;
	/** The settings page has been opened for a rate limit already this session. */
	readonly rateLimitPageOpenedRef: IBox<boolean>;
	/**
	 * The `Chat` callbacks forward to these, which the MOUNTED panel re-points on
	 * every render: the `Chat` is created once, but the code that handles a tool
	 * call or a stream error belongs to the panel on screen.
	 */
	readonly toolCallRef: IBox<NonNullable<ChatInit<UIMessage>['onToolCall']> | null>;
	readonly streamErrorRef: IBox<((error: unknown) => void) | null>;
	/** The unsent draft in the input. */
	input: string;
	/** Replies rated this session, by message id (not stored on the server yet). */
	feedback: Record<string, MessageFeedback>;
	/** Attachments staged for the next message. */
	readonly attachments: IBox<IPreviewableAttachment[]>;
	/**
	 * Update the staged attachments and tell the mounted panel. Goes through the
	 * session (not only React state) so an upload that finishes after its panel
	 * unmounted still lands in the panel now on screen.
	 */
	setAttachments(update: SetStateAction<IPreviewableAttachment[]>): void;
	/** Subscribe to attachment changes; returns the unsubscribe function. */
	onAttachments(listener: (attachments: IPreviewableAttachment[]) => void): () => void;
}

/** Client-generated conversation id (UUID v4, crypto-secure). */
export function newConversationId(): string {
	return crypto.randomUUID();
}

/** The one session of this browser window (the detached window has its own). */
let current: IAiChatSession | null = null;

/**
 * The chat session for `ownerId`: the existing one when it belongs to that
 * user, otherwise a fresh one. A previous user's session is stopped and
 * dropped, so nothing of it carries over to the next account on this browser.
 *
 * @param ownerId - The signed-in user's id.
 * @param init - The `Chat` options; `body` may read the session's conversation id.
 */
export function acquireAiChatSession(
	ownerId: string | null,
	init: (session: Pick<IAiChatSession, 'conversationIdRef'>) => Omit<ChatInit<UIMessage>, 'onToolCall' | 'onError'>
): IAiChatSession {
	if (current && current.ownerId === ownerId) {
		return current;
	}
	if (current) {
		void current.chat.stop();
	}

	const conversationIdRef: IBox<string> = { current: newConversationId() };
	const toolCallRef: IAiChatSession['toolCallRef'] = { current: null };
	const streamErrorRef: IAiChatSession['streamErrorRef'] = { current: null };
	const attachments: IBox<IPreviewableAttachment[]> = { current: [] };
	const listeners = new Set<(attachments: IPreviewableAttachment[]) => void>();

	current = {
		ownerId,
		chat: new Chat<UIMessage>({
			...init({ conversationIdRef }),
			onToolCall: (options) => toolCallRef.current?.(options),
			onError: (error) => streamErrorRef.current?.(error)
		}),
		conversationIdRef,
		sentFilesRef: { current: new Map() },
		pendingSentFilesRef: { current: null },
		rateLimitPageOpenedRef: { current: false },
		toolCallRef,
		streamErrorRef,
		input: '',
		feedback: {},
		attachments,
		setAttachments(update) {
			attachments.current = typeof update === 'function' ? update(attachments.current) : update;
			listeners.forEach((listener) => listener(attachments.current));
		},
		onAttachments(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		}
	};
	return current;
}
