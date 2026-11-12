import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CHAT_TYPING_MIN_INTERVAL_MS, CHAT_TYPING_TTL_MS, ID, IChatTypingInput, IChatTypingResult, IRealtimeTypingSignal } from '@gauzy/contracts';
import { ChatMessage } from '../entities/chat-message.entity';
import { ChatRealtime } from '../realtime/chat-realtime';
import { ChatAccessService, IChatCaller } from './chat-access.service';

/** How many places' last signals one process remembers before it forgets the ones past their TTL. */
const TYPING_MEMORY = 10_000;

/**
 * "Anna is typing…": a membership-checked typing route over the real-time channel's typing signal (the Chat plan §5).
 *
 * The caller must be a member of the conversation (not only a `CHAT_MANAGE` holder reading it) and the conversation not
 * archived; a thread named must be a root of that conversation. The signal reaches the conversation's other members
 * — the platform names them, a client names nobody — as `typing.signalled` with `expiresInMs`, after which the members
 * drop it unless the typist signals again. Nothing is stored. One member's typing in one place is told at most every
 * {@link CHAT_TYPING_MIN_INTERVAL_MS} per process (a repeat answers `sent: false`); the route's rate limit bounds the
 * rest.
 */
@Injectable()
export class ChatTypingService {
	/** When each place's typing was last told, by tenant, user, conversation and thread. */
	private readonly lastTold = new Map<string, number>();

	constructor(
		private readonly dataSource: DataSource,
		private readonly access: ChatAccessService,
		private readonly realtime: ChatRealtime
	) {}

	async typing(caller: IChatCaller & { employeeId: ID }, conversationId: ID, input: IChatTypingInput = {}, now = Date.now()): Promise<IChatTypingResult> {
		const { conversation, member } = await this.access.requireMember(conversationId, caller);
		if (!member) throw new NotFoundException('The requested record was not found');
		if (conversation.archivedAt) throw new BadRequestException('This conversation is archived.');
		const threadRootId = input.threadRootId ?? null;
		if (threadRootId) {
			const root = await this.dataSource
				.getRepository(ChatMessage)
				.findOne({ select: { id: true, threadRootId: true }, where: { id: threadRootId, conversationId, tenantId: caller.tenantId }, withDeleted: true });
			if (!root || root.threadRootId) throw new NotFoundException('The thread was not found');
		}

		const key = [caller.tenantId, caller.userId, conversationId, threadRootId ?? ''].join(':');
		if (now - (this.lastTold.get(key) ?? -Infinity) < CHAT_TYPING_MIN_INTERVAL_MS) {
			return { sent: false, expiresInMs: CHAT_TYPING_TTL_MS };
		}
		this.remember(key, now);

		const members = await this.access.members(caller.tenantId, conversationId);
		const recipients = members.map((m) => m.userId).filter((userId) => String(userId) !== String(caller.userId));
		const signal: IRealtimeTypingSignal = {
			conversationId,
			threadRootId,
			employeeId: caller.employeeId,
			userId: caller.userId,
			at: new Date(now).toISOString(),
			expiresInMs: CHAT_TYPING_TTL_MS
		};
		const sent = await this.realtime.signalTyping(signal, { tenantId: caller.tenantId, organizationId: conversation.organizationId ?? caller.organizationId ?? null }, recipients);
		return { sent, expiresInMs: CHAT_TYPING_TTL_MS };
	}

	private remember(key: string, at: number): void {
		if (this.lastTold.size >= TYPING_MEMORY) {
			for (const [place, told] of this.lastTold) {
				if (at - told >= CHAT_TYPING_TTL_MS) this.lastTold.delete(place);
			}
			// Still full of live places: the oldest go first (a Map keeps insertion order).
			while (this.lastTold.size >= TYPING_MEMORY) {
				const oldest = this.lastTold.keys().next().value;
				if (oldest === undefined) break;
				this.lastTold.delete(oldest);
			}
		}
		this.lastTold.delete(key);
		this.lastTold.set(key, at);
	}
}
