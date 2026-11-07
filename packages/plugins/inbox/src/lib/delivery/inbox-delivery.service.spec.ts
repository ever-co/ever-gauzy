import { DataSource } from 'typeorm';
import { InboxDeliveryChannelEnum, InboxDeliveryModeEnum } from '@gauzy/contracts';
import { InboxItem } from '../entities/inbox-item.entity';
import { InboxItemRecipient } from '../entities/inbox-item-recipient.entity';
import { InboxDelivery } from './inbox-delivery.entity';
import { InboxDeliveryMailer } from './inbox-delivery-mailer';
import { InboxDeliveryService } from './inbox-delivery.service';

// The sweep runs each send inside a request context of the recipient's tenant; here the context is the test's.
jest.mock('./inbox-delivery-context', () => ({
	deliveryUserOf: jest.fn(() => ({})),
	runInDeliveryContext: jest.fn((_user: unknown, fn: () => Promise<unknown>) => fn())
}));

const NOW = new Date('2026-11-07T12:30:00.000Z');

interface IntakeRow {
	recipientId: string;
	inboxItemId: string;
	userId: string;
	tenantId: string;
	organizationId: string | null;
	metadata: unknown;
}

function fixture(options: {
	intake?: IntakeRow[];
	due?: Array<Partial<InboxDelivery>>;
	items?: Array<Partial<InboxItem>>;
	users?: Record<string, { id: string; email: string | null; firstName?: string; lastName?: string; preferredLanguage?: string; timeZone?: string }>;
	settings?: Record<string, Record<string, unknown>>;
	insertFails?: boolean;
	sendFails?: boolean;
} = {}) {
	const query: Record<string, jest.Mock> = {};
	for (const name of ['innerJoin', 'select', 'addSelect', 'where', 'setParameter', 'orderBy', 'limit']) query[name] = jest.fn(() => query);
	const sub: Record<string, jest.Mock> = {};
	for (const name of ['select', 'from', 'where']) sub[name] = jest.fn(() => sub);
	sub.getQuery = jest.fn(() => '(decided)');
	query.subQuery = jest.fn(() => sub);
	query.andWhere = jest.fn((condition: string | ((qb: unknown) => string)) => {
		if (typeof condition === 'function') condition(query);
		return query;
	});
	query.getRawMany = jest.fn(async () => options.intake ?? []);
	const recipients = { createQueryBuilder: jest.fn(() => query) };
	const people: Record<string, jest.Mock> = {};
	for (const name of ['select', 'addSelect', 'where', 'andWhere', 'groupBy', 'addGroupBy', 'orderBy', 'limit']) people[name] = jest.fn(() => people);
	people.getRawMany = jest.fn(async () => {
		const seen = new Map<string, { tenantId: string; userId: string }>();
		for (const row of options.due ?? []) seen.set(`${row.tenantId}:${row.userId}`, { tenantId: String(row.tenantId), userId: String(row.userId) });
		return [...seen.values()];
	});
	const delivery = {
		create: jest.fn((row: Partial<InboxDelivery>) => row),
		insert: jest.fn(async (_row: Partial<InboxDelivery>) => {
			if (options.insertFails) throw new Error('duplicate key');
		}),
		exists: jest.fn(async () => !!options.insertFails),
		createQueryBuilder: jest.fn(() => people),
		// A person's own rows when the criteria name one (the digest's whole set), else every due row (immediate, paged).
		find: jest.fn(async (criteria: { where: Array<{ userId?: string }> }) => {
			const userId = criteria?.where?.[0]?.userId;
			return (options.due ?? []).filter((row) => !userId || row.userId === userId);
		}),
		update: jest.fn(async (_criteria: unknown, _patch: unknown) => ({ affected: 1 }))
	};
	const items = { find: jest.fn(async () => options.items ?? []) };
	const users = { findOne: jest.fn(async (query: { where: { id: string } }) => options.users?.[query.where.id] ?? null) };
	const settings = { findOne: jest.fn(async (query: { where: { employeeId: string } }) => options.settings?.[query.where.employeeId] ?? null) };
	const dataSource = {
		getRepository: (target: unknown) => {
			if (target === InboxItemRecipient) return recipients;
			if (target === InboxDelivery) return delivery;
			if (target === InboxItem) return items;
			if (target === 'User') return users;
			if (target === 'EmployeeNotificationSetting') return settings;
			throw new Error(`Unexpected repository ${String(target)}`);
		}
	} as unknown as DataSource;
	const mailer = {
		sendNotification: jest.fn(async (_recipient: unknown, _line: unknown) => {
			if (options.sendFails) throw new Error('SMTP refused');
		}),
		sendDigest: jest.fn(async (_recipient: unknown, _lines: unknown, _total: number) => {
			if (options.sendFails) throw new Error('SMTP refused');
		})
	};
	const service = new InboxDeliveryService(dataSource, mailer as unknown as InboxDeliveryMailer);
	return { service, query, delivery, mailer, users, settings, items, people };
}

const user = (id: string, email: string | null = `${id}@example.test`) => ({ id, email, firstName: 'Ada', lastName: 'Lovelace', preferredLanguage: 'bg', timeZone: 'Europe/Sofia' });
const intake = (n: number, employeeId: string, type = 'Mention'): IntakeRow => ({
	recipientId: `r${n}`,
	inboxItemId: `i${n}`,
	userId: `u${n}`,
	tenantId: 'ten',
	organizationId: 'org',
	metadata: JSON.stringify({ receiverEmployeeId: employeeId, notificationType: type })
});
const dueRow = (id: string, mode: InboxDeliveryModeEnum, overrides: Partial<InboxDelivery> = {}): Partial<InboxDelivery> => ({
	id,
	tenantId: 'ten',
	organizationId: 'org',
	inboxItemId: `i-${id}`,
	userId: 'u1',
	channel: InboxDeliveryChannelEnum.EMAIL,
	mode,
	attempts: 0,
	dueAt: NOW,
	...overrides
});
const item = (id: string, createdAt: string, type = 'Mention'): Partial<InboxItem> => ({ id, title: `Entry ${id}`, body: `<p>Body of ${id}</p>`, metadata: JSON.stringify({ notificationType: type }), createdAt: new Date(createdAt) });

describe('InboxDeliveryService.intake', () => {
	it("decides each new entry once, from the employee's setting: at once, in the digest, or not at all", async () => {
		const { service, delivery, query } = fixture({
			intake: [intake(1, 'e1'), intake(2, 'e2', 'Comment'), intake(3, 'e3')],
			users: { u1: user('u1'), u2: user('u2'), u3: user('u3') },
			settings: { e2: { preferences: { email: 'digest', digestHour: 8 } }, e3: { mention: false } }
		});
		const decided = await service.intake(NOW, 200);
		expect(decided).toBe(3);
		expect(query.where).toHaveBeenCalledWith('recipient.createdAt >= :since', { since: new Date('2026-11-06T12:30:00.000Z') });
		expect(query.andWhere.mock.calls.some((call) => call[0] === 'item.kind = :kind AND item.source = :source')).toBe(true);
		expect(query.setParameter).toHaveBeenCalledWith('channel', InboxDeliveryChannelEnum.EMAIL);
		const written = delivery.insert.mock.calls.map((call) => call[0] as Partial<InboxDelivery>);
		expect(written[0]).toMatchObject({ inboxItemId: 'i1', userId: 'u1', employeeId: 'e1', channel: 'email', mode: InboxDeliveryModeEnum.IMMEDIATE, notificationType: 'Mention', dueAt: NOW });
		expect(written[1]).toMatchObject({ inboxItemId: 'i2', mode: InboxDeliveryModeEnum.DIGEST, dueAt: new Date('2026-11-08T06:00:00.000Z'), digestKey: '2026-11-08' });
		expect(written[2]).toMatchObject({ inboxItemId: 'i3', mode: InboxDeliveryModeEnum.NONE });
		expect(written[2].dueAt).toBeUndefined();
	});

	it('leaves a row another sweep wrote in the meantime, and counts it as not its own', async () => {
		const { service, delivery } = fixture({ intake: [intake(1, 'e1')], users: { u1: user('u1') }, insertFails: true });
		expect(await service.intake(NOW, 200)).toBe(0);
		expect(delivery.exists).toHaveBeenCalledWith({ where: { inboxItemId: 'i1', userId: 'u1', channel: InboxDeliveryChannelEnum.EMAIL } });
	});
});

describe('InboxDeliveryService.sendImmediate', () => {
	it('sends one email per due row, in the recipient\'s language, and marks the row sent', async () => {
		const { service, delivery, mailer } = fixture({
			due: [dueRow('d1', InboxDeliveryModeEnum.IMMEDIATE)],
			items: [item('i-d1', '2026-11-07T12:00:00.000Z')],
			users: { u1: user('u1') }
		});
		expect(await service.sendImmediate(NOW, 200)).toEqual({ sent: 1, failed: 0 });
		expect(delivery.find).toHaveBeenCalledTimes(1);
		const criteria = delivery.find.mock.calls[0][0] as { where: Array<Record<string, unknown>>; take: number };
		expect(criteria.where).toHaveLength(2);
		expect(criteria.where[0]).toMatchObject({ channel: 'email', mode: InboxDeliveryModeEnum.IMMEDIATE });
		expect(criteria.take).toBe(200);
		expect(mailer.sendNotification).toHaveBeenCalledWith(
			{ tenantId: 'ten', organizationId: 'org', email: 'u1@example.test', name: 'Ada Lovelace', locale: 'bg' },
			{ itemId: 'i-d1', title: 'Entry i-d1', body: 'Body of i-d1', kindLabel: 'Mention' }
		);
		expect(delivery.update).toHaveBeenCalledTimes(1);
		expect(delivery.update.mock.calls[0][1]).toMatchObject({ sentAt: NOW });
	});

	it('gives up on a row whose user has no email address, or whose entry is gone', async () => {
		const { service, delivery, mailer } = fixture({
			due: [dueRow('d1', InboxDeliveryModeEnum.IMMEDIATE), dueRow('d2', InboxDeliveryModeEnum.IMMEDIATE, { userId: 'u2', inboxItemId: 'gone' })],
			items: [item('i-d1', '2026-11-07T12:00:00.000Z')],
			users: { u1: user('u1', null), u2: user('u2') }
		});
		expect(await service.sendImmediate(NOW, 200)).toEqual({ sent: 0, failed: 2 });
		expect(mailer.sendNotification).not.toHaveBeenCalled();
		expect(delivery.update.mock.calls.map((call) => (call[1] as { lastError: string }).lastError)).toEqual(['The user has no email address.', 'The entry is gone.']);
		expect(delivery.update.mock.calls.every((call) => (call[1] as { failedAt?: Date }).failedAt === NOW)).toBe(true);
	});

	it('records a failed attempt with a later next attempt, and gives up after the fifth', async () => {
		const first = fixture({ due: [dueRow('d1', InboxDeliveryModeEnum.IMMEDIATE)], items: [item('i-d1', '2026-11-07T12:00:00.000Z')], users: { u1: user('u1') }, sendFails: true });
		expect(await first.service.sendImmediate(NOW, 200)).toEqual({ sent: 0, failed: 1 });
		const patch = first.delivery.update.mock.calls[0][1] as { attempts: number; lastError: string; nextAttemptAt?: Date; failedAt?: Date };
		expect(patch).toMatchObject({ attempts: 1, lastError: 'SMTP refused', nextAttemptAt: new Date('2026-11-07T12:35:00.000Z') });
		expect(patch.failedAt).toBeUndefined();

		const last = fixture({ due: [dueRow('d1', InboxDeliveryModeEnum.IMMEDIATE, { attempts: 4 })], items: [item('i-d1', '2026-11-07T12:00:00.000Z')], users: { u1: user('u1') }, sendFails: true });
		await last.service.sendImmediate(NOW, 200);
		expect(last.delivery.update.mock.calls[0][1]).toMatchObject({ attempts: 5, failedAt: NOW });
	});
});

describe('InboxDeliveryService.sendDigests', () => {
	it('sends one digest per person — the people first, then each one\'s whole due set — newest first, every row of it marked sent', async () => {
		const { service, delivery, mailer, people } = fixture({
			due: [dueRow('a', InboxDeliveryModeEnum.DIGEST), dueRow('b', InboxDeliveryModeEnum.DIGEST), dueRow('c', InboxDeliveryModeEnum.DIGEST, { userId: 'u2' })],
			items: [item('i-a', '2026-11-07T08:00:00.000Z', 'Comment'), item('i-b', '2026-11-07T11:00:00.000Z'), item('i-c', '2026-11-07T09:00:00.000Z')],
			users: { u1: user('u1'), u2: user('u2') }
		});
		expect(await service.sendDigests(NOW, 200)).toEqual({ sent: 2, failed: 0 });
		expect(people.limit).toHaveBeenCalledWith(200);
		expect(people.groupBy).toHaveBeenCalledWith('delivery.tenantId');
		// A person's rows are read without a page: the digest is the whole due set.
		const personCriteria = delivery.find.mock.calls[0][0] as { where: Array<Record<string, unknown>>; take?: number };
		expect(personCriteria.where[0]).toMatchObject({ mode: InboxDeliveryModeEnum.DIGEST, tenantId: 'ten', userId: 'u1' });
		expect(personCriteria.take).toBeUndefined();
		expect(mailer.sendDigest).toHaveBeenCalledTimes(2);
		const [recipient, lines, total] = mailer.sendDigest.mock.calls[0] as unknown as [{ email: string }, Array<{ itemId: string; kindLabel: string }>, number];
		expect(recipient.email).toBe('u1@example.test');
		expect(lines.map((line) => line.itemId)).toEqual(['i-b', 'i-a']);
		expect(lines[1].kindLabel).toBe('Comment');
		expect(total).toBe(2);
		expect(delivery.update).toHaveBeenCalledTimes(2);
		expect(delivery.update.mock.calls[0][0]).toEqual({ id: expect.objectContaining({ _value: ['a', 'b'] }) });
	});

	it('keeps the whole digest for a later attempt when its email fails, and drops only the entries that are gone', async () => {
		const { service, delivery, mailer } = fixture({
			due: [dueRow('a', InboxDeliveryModeEnum.DIGEST), dueRow('b', InboxDeliveryModeEnum.DIGEST, { inboxItemId: 'gone' })],
			items: [item('i-a', '2026-11-07T08:00:00.000Z')],
			users: { u1: user('u1') },
			sendFails: true
		});
		expect(await service.sendDigests(NOW, 200)).toEqual({ sent: 0, failed: 1 });
		expect(mailer.sendDigest).toHaveBeenCalledTimes(1);
		const gone = delivery.update.mock.calls.find((call) => (call[1] as { lastError?: string }).lastError === 'The entry is gone.');
		expect(gone?.[0]).toEqual({ id: expect.objectContaining({ _value: ['b'] }) });
		const failed = delivery.update.mock.calls.find((call) => (call[1] as { lastError?: string }).lastError === 'SMTP refused');
		expect(failed?.[0]).toEqual({ id: expect.objectContaining({ _value: ['a'] }) });
		expect(failed?.[1]).toMatchObject({ attempts: 1 });
	});
});
