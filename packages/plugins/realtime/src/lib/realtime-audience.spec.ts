import { AsyncLocalStorage } from 'async_hooks';
import { ClsService } from 'nestjs-cls';
import {
	BaseEntityEnum,
	CHAT_EVENT_NAMES,
	ID,
	PermissionsEnum,
	REALTIME_EVENT_NAMES,
	RolesEnum
} from '@gauzy/contracts';
import {
	CommentParentAccessService,
	EventOutboxService,
	GraphqlPubSub,
	RequestContext,
	SubscriptionCatalogue
} from '@gauzy/core';
import type { SubscriptionAudienceCheck, SubscriptionAudienceEvent } from '@gauzy/core';
import { DocumentService } from '@gauzy/plugin-docs';
import { RealtimeResolver } from './graphql/realtime.resolver';
import { RealtimeAudience, screenAudience } from './realtime-audience';
import { CatchUpRow, RealtimeCatchUpService } from './realtime-catch-up.service';

/**
 * Who receives a collaboration fact: decided at delivery, live and in the catch-up, by the subscriber's read access
 * to the record the fact names (pages, tasks, comment threads) and by the checks other plugins register (chat
 * membership). Every case runs as a signed-in user with a real CLS store behind `RequestContext`, the way the
 * socket and the catch-up route run.
 */
const TENANT = 'tenant-1';
const ORG = 'org-1';
const OTHER_ORG = 'org-2';
/** A contact whose notes follow the contact's comment-access policy (the policy reads uuids only). */
const CONTACT = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

function user(id: string, permissions: PermissionsEnum[]) {
	return {
		id,
		tenantId: TENANT,
		employeeId: `employee-${id}`,
		lastOrganizationId: ORG,
		role: { name: RolesEnum.EMPLOYEE },
		permissions: [PermissionsEnum.REALTIME_SUBSCRIBE, ...permissions]
	};
}

/** Reads every page it may, the tasks and the contacts. */
const READER = user('reader', [
	PermissionsEnum.DOCS_READ,
	PermissionsEnum.ORG_TASK_VIEW,
	PermissionsEnum.ORG_CONTACT_VIEW
]);
/** Reads the organization's pages only: not the private page, no task, no contact. */
const OUTSIDER = user('outsider', [PermissionsEnum.DOCS_READ]);
/** No documents read permission at all. */
const NO_DOCS = user('no-docs', [PermissionsEnum.ORG_TASK_VIEW]);
/** A current member of conversation c1, and a member removed from it. */
const MEMBER = user('member', []);
const REMOVED = user('removed', []);

const as = <T>(who: ReturnType<typeof user>, work: () => T): T =>
	RequestContext.runWithRequest({ user: who } as never, work);

/** The docs plugin's read predicate, as `filterReadableDocumentIds` answers it for the requesting user. */
class FakeDocumentService {
	readonly calls: Array<{ ids: ID[]; organizationId: ID; options: unknown; asUser: ID | null }> = [];
	async filterReadableDocumentIds(ids: ID[], organizationId: ID, options?: unknown): Promise<ID[]> {
		const asUser = RequestContext.currentUserId();
		this.calls.push({ ids, organizationId, options, asUser });
		return ids.filter((id) => id === 'page-org' || (id === 'page-private' && asUser === 'reader'));
	}
}

/** The chat plugin's membership check as it registers it: c1's current members, and the removal notice to its subject. */
function membershipCheck(calls: number[]): SubscriptionAudienceCheck {
	const members: Record<string, string[]> = { c1: ['member'] };
	return (events, subscriber) => {
		calls.push(events.length);
		return events.map(
			(event) =>
				(members[String(event.data['conversationId'])] ?? []).includes(String(subscriber.userId)) ||
				(event.name === CHAT_EVENT_NAMES.CONVERSATION_CHANGED && event.data['change'] === 'removed')
		);
	};
}

let rowSeq = 0;
function row(
	eventName: string,
	aggregateType: string,
	aggregateId: string,
	payload: Record<string, unknown>
): CatchUpRow {
	rowSeq += 1;
	return {
		eventId: `e${String(rowSeq).padStart(3, '0')}`,
		eventName,
		aggregateType,
		aggregateId,
		createdAt: new Date(1_000 + rowSeq),
		sequence: 1,
		payload
	} as CatchUpRow;
}

const documentRow = (id: string, organizationId = ORG) =>
	row(REALTIME_EVENT_NAMES.DOCUMENT_UPDATED, 'document', id, {
		entity: 'Document',
		entityId: id,
		action: 'updated',
		organizationId
	});
const taskRow = (id: string, organizationId = ORG) =>
	row(REALTIME_EVENT_NAMES.TASK_UPDATED, 'task', id, {
		entity: 'Task',
		entityId: id,
		action: 'updated',
		organizationId
	});
const commentRow = (id: string, parent: { entity: string; entityId: string }) =>
	row(REALTIME_EVENT_NAMES.COMMENT_CREATED, 'comment', id, {
		entity: 'Comment',
		entityId: id,
		action: 'created',
		organizationId: ORG,
		parent
	});
const chatRow = (name: string, data: Record<string, unknown>, recipients: string[]) =>
	row(name, 'chat_message', String(data['messageId'] ?? data['conversationId']), {
		...data,
		recipientUserIds: recipients
	});

describe('realtime audience', () => {
	const originalClsService = RequestContext['clsService'];
	let documents: FakeDocumentService;
	let catalogue: SubscriptionCatalogue;
	let comments: CommentParentAccessService;
	let membershipCalls: number[];
	let audience: RealtimeAudience;
	let rows: CatchUpRow[];
	let catchUp: RealtimeCatchUpService;

	beforeAll(() => RequestContext.setClsService(new ClsService(new AsyncLocalStorage())));
	afterAll(() => {
		RequestContext['clsService'] = originalClsService;
	});

	beforeEach(() => {
		documents = new FakeDocumentService();
		catalogue = new SubscriptionCatalogue();
		catalogue.declare(...Object.values(CHAT_EVENT_NAMES));
		membershipCalls = [];
		catalogue.restrictAudience(membershipCheck(membershipCalls), ...Object.values(CHAT_EVENT_NAMES));
		comments = new CommentParentAccessService();
		comments.register({
			entity: BaseEntityEnum.OrganizationContact,
			readPermissions: [PermissionsEnum.ORG_CONTACT_VIEW],
			writePermissions: [PermissionsEnum.ORG_CONTACT_EDIT],
			findAccessibleParent: async (id: ID) => (id === CONTACT ? { id, organizationId: ORG } : null)
		});
		rows = [];
		const outbox = {
			listOutboxRowsSince: async (query: { eventNames?: readonly string[]; limit: number }) =>
				query.eventNames
					? rows.filter((candidate) => query.eventNames?.includes(candidate.eventName))
					: rows.slice(0, 1)
		};
		const providers = new Map<unknown, unknown>([
			[DocumentService, documents],
			[SubscriptionCatalogue, catalogue],
			[CommentParentAccessService, comments],
			[EventOutboxService, outbox]
		]);
		const moduleRef = {
			get: (token: unknown) => {
				if (!providers.has(token)) throw new Error('not in this process');
				return providers.get(token);
			}
		};
		audience = new RealtimeAudience(moduleRef as never);
		catchUp = new RealtimeCatchUpService(moduleRef as never, audience);
	});

	/** The event ids one user's catch-up answers. */
	const caughtUp = async (who: ReturnType<typeof user>) =>
		(await as(who, () => catchUp.catchUp({ after: 0 }))).events.map((event) => event.aggregate.id);

	describe('screenAudience', () => {
		const event = (name: string, id: string): SubscriptionAudienceEvent => ({
			name,
			aggregateType: 'x',
			aggregateId: id,
			data: {}
		});
		const subscriber = { tenantId: TENANT, userId: 'u1' };

		it('asks each check once per batch and delivers only what every check admits', async () => {
			const first = jest.fn((events: readonly SubscriptionAudienceEvent[]) =>
				events.map((e) => e.aggregateId !== 'b')
			);
			const second = jest.fn((events: readonly SubscriptionAudienceEvent[]) =>
				events.map((e) => e.aggregateId !== 'c')
			);
			const verdicts = await screenAudience(
				[event('a.x', 'a'), event('a.x', 'b'), event('a.x', 'c'), event('free.x', 'd')],
				subscriber,
				(name) => (name === 'a.x' ? [first, second] : [])
			);
			expect(verdicts).toEqual([true, false, false, true]);
			expect(first).toHaveBeenCalledTimes(1);
			expect(second).toHaveBeenCalledTimes(1);
			expect(first.mock.calls[0][0]).toHaveLength(3);
		});

		it('refuses rather than guesses when a check throws or miscounts', async () => {
			await expect(
				screenAudience([event('a.x', 'a')], subscriber, () => [() => Promise.reject(new Error('db down'))])
			).rejects.toThrow('db down');
			const miscounts: SubscriptionAudienceCheck = () => [true];
			await expect(
				screenAudience([event('a.x', 'a'), event('a.x', 'b')], subscriber, () => [miscounts])
			).rejects.toThrow(/verdicts/);
		});
	});

	describe('catch-up', () => {
		it('replays a private page to its readers only, and an organization page to every documents reader', async () => {
			rows.push(documentRow('page-private'), documentRow('page-org'));
			expect(await caughtUp(READER)).toEqual(['page-private', 'page-org']);
			expect(await caughtUp(OUTSIDER)).toEqual(['page-org']);
			expect(await caughtUp(NO_DOCS)).toEqual([]);
			// One read-scope query per batch, trashed pages included (a `deleted` fact names one), as the subscriber.
			const asReader = documents.calls.filter((call) => call.asUser === 'reader');
			expect(asReader).toHaveLength(1);
			expect(asReader[0]).toMatchObject({
				ids: ['page-private', 'page-org'],
				organizationId: ORG,
				options: { withDeleted: true }
			});
			// Without the documents read permission, nothing is asked at all.
			expect(documents.calls.some((call) => call.asUser === 'no-docs')).toBe(false);
		});

		it('replays task facts to those who may read tasks, inside their organization', async () => {
			rows.push(taskRow('task-1'), taskRow('task-other-org', OTHER_ORG));
			expect(await caughtUp(READER)).toEqual(['task-1']);
			expect(await caughtUp(OUTSIDER)).toEqual([]);
		});

		it('replays comment facts by the read rule of the record whose comments changed', async () => {
			rows.push(
				commentRow('on-private-page', { entity: BaseEntityEnum.Document, entityId: 'page-private' }),
				commentRow('on-org-page', { entity: BaseEntityEnum.Document, entityId: 'page-org' }),
				commentRow('on-task', { entity: BaseEntityEnum.Task, entityId: 'task-1' }),
				commentRow('on-contact', { entity: BaseEntityEnum.OrganizationContact, entityId: CONTACT }),
				commentRow('on-employee', { entity: BaseEntityEnum.Employee, entityId: 'employee-x' })
			);
			expect(await caughtUp(READER)).toEqual([
				'on-private-page',
				'on-org-page',
				'on-task',
				'on-contact',
				'on-employee'
			]);
			// A record without a read rule of its own keeps the comment API's: the tenant and organization.
			expect(await caughtUp(OUTSIDER)).toEqual(['on-org-page', 'on-employee']);
		});

		it('replays a conversation to its current members only, and the removal notice to the member removed', async () => {
			rows.push(
				chatRow(CHAT_EVENT_NAMES.MESSAGE_CREATED, { conversationId: 'c1', messageId: 'm1' }, [
					'member',
					'removed'
				]),
				chatRow(CHAT_EVENT_NAMES.CONVERSATION_CHANGED, { conversationId: 'c1', change: 'removed' }, ['removed'])
			);
			expect(await caughtUp(MEMBER)).toEqual(['m1']);
			expect(await caughtUp(REMOVED)).toEqual(['c1']);
			// One membership check per catch-up batch, however many chat rows it holds.
			expect(membershipCalls).toEqual([1, 2]);
		});

		it('walks past the rows it refused instead of stalling on them', async () => {
			rows.push(documentRow('page-private'), documentRow('page-private'), documentRow('page-org'));
			const first = await as(OUTSIDER, () => catchUp.catchUp({ after: 0, limit: 1 }));
			expect(first.events.map((event) => event.aggregate.id)).toEqual(['page-org']);
			expect(first.cursorId).toBe(rows[2].eventId);
		});

		it('fails the catch-up when a check cannot answer, rather than skipping rows nobody decided', async () => {
			rows.push(documentRow('page-org'));
			jest.spyOn(documents, 'filterReadableDocumentIds').mockRejectedValueOnce(new Error('db down'));
			await expect(as(READER, () => catchUp.catchUp({ after: 0 }))).rejects.toThrow('db down');
		});
	});

	describe('live delivery', () => {
		let pubSub: GraphqlPubSub;
		let resolver: RealtimeResolver;

		beforeEach(() => {
			pubSub = new GraphqlPubSub();
			resolver = new RealtimeResolver(pubSub, catalogue, audience);
		});
		afterEach(() => pubSub.onModuleDestroy());

		/** Pulls the next value, or `'nothing'` when none arrives in time. */
		const nextWithin = async <T>(iterator: AsyncIterator<T>, ms = 100): Promise<T | 'nothing'> => {
			let timer: NodeJS.Timeout | undefined;
			const timeout = new Promise<'nothing'>((resolve) => (timer = setTimeout(() => resolve('nothing'), ms)));
			const result = await Promise.race([
				iterator.next().then((r) => (r.done ? ('nothing' as const) : r.value)),
				timeout
			]);
			clearTimeout(timer);
			return result;
		};

		/** Publishes one stored row the way the outbox consumer does. */
		const publish = (stored: CatchUpRow) => {
			const recipients = (stored.payload as Record<string, unknown>)['recipientUserIds'];
			return pubSub.publish(stored.eventName, TENANT, {
				eventId: stored.eventId,
				name: stored.eventName,
				occurredAt: stored.createdAt,
				tenantId: TENANT,
				organizationId: ORG,
				aggregate: { type: stored.aggregateType, id: stored.aggregateId },
				data: stored.payload,
				...(recipients ? { recipientUserIds: recipients } : {})
			});
		};

		const open = (who: ReturnType<typeof user>, names: string[]) =>
			as(who, () => resolver.collaborationEvents(names));

		it('streams a private page to its readers only', async () => {
			const reader = open(READER, [REALTIME_EVENT_NAMES.DOCUMENT_UPDATED]);
			const outsider = open(OUTSIDER, [REALTIME_EVENT_NAMES.DOCUMENT_UPDATED]);
			await publish(documentRow('page-private'));
			await publish(documentRow('page-org'));
			expect(await nextWithin(reader)).toMatchObject({ aggregate: { id: 'page-private' } });
			expect(await nextWithin(reader)).toMatchObject({ aggregate: { id: 'page-org' } });
			expect(await nextWithin(outsider)).toMatchObject({ aggregate: { id: 'page-org' } });
			expect(await nextWithin(outsider)).toBe('nothing');
			await reader.return?.();
			await outsider.return?.();
		});

		it('streams task facts and the comments on a private page to those who may read them', async () => {
			const reader = open(READER, ['task.*', 'comment.*']);
			const outsider = open(OUTSIDER, ['task.*', 'comment.*']);
			await publish(taskRow('task-1'));
			await publish(commentRow('on-private-page', { entity: BaseEntityEnum.Document, entityId: 'page-private' }));
			// Two topics: the merged stream hands them over in either order.
			const received = [await nextWithin(reader), await nextWithin(reader)].map((value) =>
				value === 'nothing' ? value : value.aggregate.id
			);
			expect(received.sort()).toEqual(['on-private-page', 'task-1']);
			expect(await nextWithin(outsider)).toBe('nothing');
			await reader.return?.();
			await outsider.return?.();
		});

		it('does not deliver a conversation fact addressed before the removal to the member removed', async () => {
			const member = open(MEMBER, [CHAT_EVENT_NAMES.MESSAGE_CREATED]);
			const removed = open(REMOVED, [CHAT_EVENT_NAMES.MESSAGE_CREATED]);
			await publish(
				chatRow(CHAT_EVENT_NAMES.MESSAGE_CREATED, { conversationId: 'c1', messageId: 'm1' }, [
					'member',
					'removed'
				])
			);
			expect(await nextWithin(member)).toMatchObject({ aggregate: { id: 'm1' }, data: { conversationId: 'c1' } });
			expect(await nextWithin(removed)).toBe('nothing');
			await member.return?.();
			await removed.return?.();
		});
	});
});
