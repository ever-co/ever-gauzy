import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In, IsNull } from 'typeorm';
import { IChatSearchQuery, IChatSearchResult, SearchFilterOperator } from '@gauzy/contracts';
import { SearchService } from '@gauzy/plugin-search';
import { CHAT_AGGREGATES, CHAT_MAX_PAGE_SIZE, CHAT_PAGE_SIZE } from '../chat.constants';
import { ChatMember } from '../entities/chat-member.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { ChatAccessService, IChatCaller } from './chat-access.service';
import { ChatMessageService } from './chat-message.service';

/** How far a search may page (the index answers a count; a listing beyond this is what the messages route is for): a `skip` past it is refused. */
const CHAT_SEARCH_MAX_SKIP = 10_000;

/**
 * Search over chat messages, through the platform's search plugin (the `chat_message` declaration it ships) and
 * narrowed to the caller's own conversations: a hit is only ever a message of a conversation the caller is a
 * member of, because every query carries that set as a filter — the index's permission says a person may search
 * chat, not which conversations are theirs. The declaration is private, so the generic search routes leave it
 * out and this route is the one way to it (`SearchService.searchWithin`). The hits come back as messages with
 * their relations, best match first; a message deleted since it was indexed is left out.
 */
@Injectable()
export class ChatSearchService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly access: ChatAccessService,
		private readonly messages: ChatMessageService,
		private readonly searchService: SearchService
	) {}

	async search(caller: IChatCaller, query: IChatSearchQuery): Promise<IChatSearchResult> {
		const q = String(query.q ?? '').trim();
		if (!q) throw new BadRequestException('A search needs a query.');
		const limit = Math.min(Math.max(Number(query.limit) || CHAT_PAGE_SIZE, 1), CHAT_MAX_PAGE_SIZE);
		const skip = Math.max(Number(query.skip) || 0, 0);
		// Refused, not clamped: a clamped skip would answer the same page again, and a client following `hasMore` would loop.
		if (skip > CHAT_SEARCH_MAX_SKIP) throw new BadRequestException(`A search pages no further than ${CHAT_SEARCH_MAX_SKIP} hits.`);
		const mine = await this.memberConversationIds(caller);
		let scope = mine;
		if (query.conversationId) {
			// A conversation the caller is not in is not there to search, nor to tell apart from one that does not exist.
			if (!mine.includes(String(query.conversationId))) throw new NotFoundException('The requested record was not found');
			scope = [String(query.conversationId)];
		}
		// An empty set must never reach the index: a filter with no values is not a filter.
		if (!scope.length) return { messages: [], total: 0, hasMore: false };
		const page = await this.searchService.searchWithin({
			q,
			entities: [CHAT_AGGREGATES.MESSAGE],
			filters: [{ attribute: 'conversationId', operator: SearchFilterOperator.IN, value: scope, entity: CHAT_AGGREGATES.MESSAGE }],
			take: limit,
			skip,
			withFacets: false
		});
		const ids = (page.items ?? []).map((hit) => String(hit.entityId));
		const rows = ids.length
			? await this.dataSource.getRepository(ChatMessage).find({ where: { id: In(ids), tenantId: caller.tenantId, conversationId: In(scope) } })
			: [];
		const byId = new Map(rows.map((row) => [String(row.id), row]));
		const ordered = ids.map((id) => byId.get(id)).filter((row): row is ChatMessage => !!row && !row.deletedAt);
		const messages = await this.messages.withRelations(caller, ordered);
		const total = Number(page.total ?? messages.length);
		// No next page past the cap either: the one that would start beyond it cannot be asked for.
		return { messages, total, hasMore: skip + ids.length < total && skip + limit <= CHAT_SEARCH_MAX_SKIP };
	}

	/** The conversations the caller is a member of (by user: a membership is the person's, employee or not; one they left is not theirs to search). */
	private async memberConversationIds(caller: IChatCaller): Promise<string[]> {
		const rows = await this.dataSource.getRepository(ChatMember).find({ select: { conversationId: true }, where: { tenantId: caller.tenantId, userId: caller.userId, leftAt: IsNull() } });
		return [...new Set(rows.map((row) => String(row.conversationId)))];
	}
}
