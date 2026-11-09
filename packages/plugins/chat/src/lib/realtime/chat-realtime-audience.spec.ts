import { CHAT_EVENT_NAMES, CHAT_STREAMED_EVENTS } from '@gauzy/contracts';
import { SubscriptionCatalogue } from '@gauzy/core';
import type { SubscriptionAudienceCheck, SubscriptionAudienceEvent } from '@gauzy/core';
import { CHAT_AUDIENCE_QUERY_CHUNK, ChatMembershipAudience } from './chat-realtime-audience';
import { ChatRealtime } from './chat-realtime';

const TENANT = 'tenant-1';

/** The `chat_member` rows the membership query reads (the fake honours `In`, `IsNull` and the tenant). */
const MEMBERS = [
	{ tenantId: TENANT, conversationId: 'c1', userId: 'member', leftAt: null },
	{ tenantId: TENANT, conversationId: 'c1', userId: 'removed', leftAt: new Date('2026-11-01') },
	{ tenantId: TENANT, conversationId: 'c2', userId: 'removed', leftAt: null },
	{ tenantId: 'tenant-2', conversationId: 'c3', userId: 'member', leftAt: null }
];

type Where = {
	tenantId: string;
	userId: { value: string[] };
	conversationId: { value: string[] };
	leftAt: { type: string };
};

function fakeDataSource() {
	const find = jest.fn(async ({ where }: { where: Where }) =>
		MEMBERS.filter(
			(row) =>
				row.tenantId === where.tenantId &&
				where.userId.value.includes(row.userId) &&
				where.conversationId.value.includes(row.conversationId) &&
				(where.leftAt.type !== 'isNull' || row.leftAt === null)
		)
	);
	return { find, dataSource: { getRepository: () => ({ find }), manager: {} } };
}

const fact = (name: string, data: Record<string, unknown>): SubscriptionAudienceEvent => ({
	name,
	aggregateType: 'chat_message',
	aggregateId: String(data['messageId'] ?? data['conversationId'] ?? 'x'),
	data
});
const message = (conversationId: string) =>
	fact(CHAT_EVENT_NAMES.MESSAGE_CREATED, { conversationId, messageId: `m-${conversationId}` });
const as = (userId: string | null) => ({ tenantId: TENANT, organizationId: 'org-1', userId });

describe('chat realtime audience', () => {
	it('registers the membership check for every chat name when it declares them', () => {
		const catalogue = new SubscriptionCatalogue();
		const { dataSource } = fakeDataSource();
		const moduleRef = {
			get: (token: unknown) => {
				if (token === SubscriptionCatalogue) return catalogue;
				throw new Error('not in this process');
			}
		};
		new ChatRealtime(dataSource as never, moduleRef as never).onModuleInit();
		for (const name of CHAT_STREAMED_EVENTS) {
			expect(catalogue.has(name)).toBe(true);
			expect(catalogue.audienceOf(name)).toHaveLength(1);
		}
	});

	describe('the check', () => {
		let find: jest.Mock;
		let check: SubscriptionAudienceCheck;

		beforeEach(() => {
			const fake = fakeDataSource();
			find = fake.find;
			check = new ChatMembershipAudience(fake.dataSource as never).check;
		});

		it('delivers a conversation fact to a current member, never to a member removed since it was written', async () => {
			expect(await check([message('c1')], as('member'))).toEqual([true]);
			expect(await check([message('c1')], as('removed'))).toEqual([false]);
			// Membership is per conversation: the removed member still reads the conversation they are in.
			expect(await check([message('c2')], as('removed'))).toEqual([true]);
			// And per tenant: the same ids in another tenant are not a membership here.
			expect(await check([message('c3')], as('member'))).toEqual([false]);
		});

		it('still tells the removed member of their own removal', async () => {
			const removal = fact(CHAT_EVENT_NAMES.CONVERSATION_CHANGED, { conversationId: 'c1', change: 'removed' });
			const update = fact(CHAT_EVENT_NAMES.CONVERSATION_CHANGED, { conversationId: 'c1', change: 'updated' });
			expect(await check([removal, update], as('removed'))).toEqual([true, false]);
		});

		it('refuses a fact without a conversation, and a subscriber without a user', async () => {
			expect(await check([fact(CHAT_EVENT_NAMES.MESSAGE_CREATED, { messageId: 'm' })], as('member'))).toEqual([
				false
			]);
			expect(await check([message('c1')], as(null))).toEqual([false]);
			expect(find).not.toHaveBeenCalled();
		});

		it('answers a whole catch-up page with one query', async () => {
			const page = [
				message('c1'),
				message('c2'),
				message('c1'),
				fact(CHAT_EVENT_NAMES.THREAD_CHANGED, { conversationId: 'c2', rootMessageId: 'r' })
			];
			expect(await check(page, as('removed'))).toEqual([false, true, false, true]);
			expect(find).toHaveBeenCalledTimes(1);
		});

		it('answers the connections a live fact fans out to in the same turn with one query', async () => {
			const verdicts = await Promise.all([
				check([message('c1')], as('member')),
				check([message('c1')], as('removed')),
				check([message('c2')], as('member'))
			]);
			expect(verdicts).toEqual([[true], [false], [false]]);
			expect(find).toHaveBeenCalledTimes(1);
		});

		it('names at most a chunk of ids per query', async () => {
			const many = Array.from({ length: CHAT_AUDIENCE_QUERY_CHUNK + 1 }, (_, index) =>
				message(index === 0 ? 'c1' : `x${index}`)
			);
			const verdicts = await check(many, as('member'));
			expect(verdicts[0]).toBe(true);
			expect(verdicts.slice(1).every((verdict) => verdict === false)).toBe(true);
			expect(find).toHaveBeenCalledTimes(2);
		});

		it('rejects when the membership cannot be read, so the delivery refuses', async () => {
			find.mockRejectedValueOnce(new Error('db down'));
			await expect(check([message('c1')], as('member'))).rejects.toThrow('db down');
		});
	});
});
