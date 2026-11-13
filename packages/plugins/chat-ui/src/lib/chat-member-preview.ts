import { signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { ID, IChatConversationWithState, IChatMemberSummary } from '@gauzy/contracts';

/** The part of a conversation the member preview looks at. */
export type ChatMemberPreviewSource = Pick<IChatConversationWithState, 'id' | 'memberCount' | 'members'>;

/** A conversation at one member count: a member joining or leaving changes it, so what was read for it is read again. */
export function membersKey(conversation: Pick<IChatConversationWithState, 'id' | 'memberCount'>): string {
	return `${conversation.id}:${conversation.memberCount ?? 0}`;
}

/**
 * The first members of the open conversation, for the faces on its member button. The list of conversations leaves
 * a channel's members out, so they are read on their own (`read`), once per conversation and member count:
 *
 * - members that come with the conversation (a direct or group conversation, or the conversation read again after a
 *   member change) are the newest, and are kept for the list refreshes that leave them out;
 * - a change of the member count (someone joined, left or was removed) reads them again, and the previous ones show
 *   until the new ones arrive;
 * - one read at a time per conversation and count; one that failed, or whose answer came after the conversation or
 *   its count changed (and was dropped), does not block the next visit from reading again;
 * - only the latest read's answer counts: an older one, or one overtaken by members that came with the conversation,
 *   is dropped, so reads finishing out of order never put older members back;
 * - a conversation with nobody in it shows no faces, and forgets the ones it had.
 */
export class ChatMemberPreview {
	/** The members last known, for one conversation at one member count. */
	private readonly known = signal<{ id: string; key: string; members: readonly IChatMemberSummary[] } | null>(null);
	/** The conversation and count whose read is under way. */
	private asking: string | null = null;
	/** Counts the reads, and the newer members that make a read under way outdated: only the latest read's answer is kept. */
	private generation = 0;
	private readonly requests = new Subscription();

	constructor(private readonly read: (conversationId: ID) => Observable<IChatMemberSummary[]>) {}

	/** The members to show for `conversation`: none when it has none, else its own, or the ones last read for it (reactive). */
	members(conversation: ChatMemberPreviewSource): readonly IChatMemberSummary[] {
		if (!(conversation.memberCount > 0)) return [];
		if (conversation.members?.length) return conversation.members;
		const known = this.known();
		return known && known.id === String(conversation.id) ? known.members : [];
	}

	/**
	 * The conversation shown now (`isMember`: only a member may read the members). Reads its members when they are
	 * not known for its current count; `current` is asked when the answer comes, which is dropped unless it still fits
	 * and no newer read or newer members came since.
	 */
	follow(conversation: ChatMemberPreviewSource, isMember: boolean, current: () => Pick<IChatConversationWithState, 'id' | 'memberCount'>): void {
		const id = String(conversation.id);
		const key = membersKey(conversation);
		if (!(conversation.memberCount > 0)) {
			// Nobody left: nothing to show, and a read under way is outdated.
			this.outdateReads();
			if (this.known()?.id === id) this.known.set(null);
			return;
		}
		if (conversation.members?.length) {
			// Members that came with the conversation are the newest: a read under way must not replace them.
			this.outdateReads();
			this.known.set({ id, key, members: conversation.members });
			return;
		}
		if (!isMember) return;
		if (this.known()?.key === key || this.asking === key) return;
		const ticket = ++this.generation;
		this.asking = key;
		this.requests.add(
			this.read(conversation.id).subscribe({
				next: (members) => {
					if (ticket !== this.generation) return;
					this.asking = null;
					if (membersKey(current()) === key) this.known.set({ id, key, members });
				},
				error: () => {
					if (ticket === this.generation) this.asking = null;
				}
			})
		);
	}

	/** Stops the reads under way (the view is gone). */
	destroy(): void {
		this.requests.unsubscribe();
	}

	/** The reads under way are outdated: their answers are dropped, and the next visit may read again. */
	private outdateReads(): void {
		this.generation += 1;
		this.asking = null;
	}
}
