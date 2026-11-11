import { DataSource } from 'typeorm';
import { INBOX_NOTIFICATION_EXTERNAL_SOURCE, InboxDeliveryChannelEnum, InboxDeliveryModeEnum } from '@gauzy/contracts';
import { InboxItem } from '../entities/inbox-item.entity';
import { InboxItemRecipient } from '../entities/inbox-item-recipient.entity';
import { InboxDelivery } from './inbox-delivery.entity';
import { InboxDeliveryContextUnavailableError } from './inbox-delivery-context';
import { INBOX_DELIVERY_SKIPPED_READ, INBOX_DELIVERY_TIMER_REMINDER_GRACE_MS } from './inbox-delivery.constants';
import { InboxDeliveryMailer } from './inbox-delivery-mailer';
import { InboxDeliveryService } from './inbox-delivery.service';
import { InboxPushGoneError, InboxPushRefusedError } from './push/inbox-delivery-pusher';
import { INBOX_PUSH_NO_SUBSCRIPTION, INBOX_PUSH_SKIPPED_FOCUSED } from './push/inbox-push.constants';

// The sweep serves the channels the switches name; the email tests run with email alone, the push tests add push.
process.env['GAUZY_INBOX_NOTIFICATION_EMAIL_ENABLED'] = 'true';

// The sweep runs each send inside a request context of the recipient's tenant; here the context is the test's.
jest.mock('./inbox-delivery-context', () => ({
	InboxDeliveryContextUnavailableError: class InboxDeliveryContextUnavailableError extends Error {},
	deliveryUserOf: jest.fn(() => ({})),
	runInDeliveryContext: jest.fn((_user: unknown, fn: () => Promise<unknown>) => fn())
}));

const NOW = new Date('2026-11-07T12:30:00.000Z');
/** When a timer reminder decided now is emailed and pushed, unless it is read by then. */
const AFTER_WAIT = new Date(NOW.getTime() + INBOX_DELIVERY_TIMER_REMINDER_GRACE_MS);

interface IntakeRow {
	recipientId: string;
	inboxItemId: string;
	userId: string;
	tenantId: string;
	organizationId: string | null;
	metadata: unknown;
	isRead?: unknown;
}

function fixture(
	options: {
		intake?: IntakeRow[];
		due?: Array<Partial<InboxDelivery>>;
		items?: Array<Partial<InboxItem>>;
		users?: Record<
			string,
			{
				id: string;
				email: string | null;
				firstName?: string;
				lastName?: string;
				preferredLanguage?: string;
				timeZone?: string;
			}
		>;
		settings?: Record<string, Record<string, unknown>>;
		insertFails?: boolean;
		sendFails?: boolean;
		contextFails?: boolean;
		/** The push wiring: the person's devices (by user), the ones the push service says are gone, the employees' heartbeats. */
		push?: boolean;
		devices?: Record<
			string,
			Array<{ id: string; endpoint: string; p256dh: string; auth: string; failures?: number }>
		>;
		gone?: string[];
		refused?: string[];
		pushFails?: boolean;
		employees?: Record<string, { lastSeenAt: Date | null; isIdle: boolean }>;
		/** The entries their person has read by the time a row is due (the recipient row's `isRead`). */
		readEntries?: string[];
		/** The notifications marked read through the notification API (the notification row's `isRead`). */
		readNotifications?: string[];
	} = {}
) {
	// Named keys, not `Record<string, …>`: the plugin compiles with `noPropertyAccessFromIndexSignature` (TS4111).
	const query = {} as Record<'innerJoin' | 'select' | 'addSelect' | 'where' | 'setParameter' | 'orderBy' | 'limit' | 'subQuery' | 'andWhere' | 'getRawMany', jest.Mock>;
	for (const name of ['innerJoin', 'select', 'addSelect', 'where', 'setParameter', 'orderBy', 'limit'] as const) query[name] = jest.fn(() => query);
	const sub = {} as Record<'select' | 'from' | 'where' | 'getQuery', jest.Mock>;
	for (const name of ['select', 'from', 'where'] as const) sub[name] = jest.fn(() => sub);
	sub.getQuery = jest.fn(() => '(decided)');
	query.subQuery = jest.fn(() => sub);
	query.andWhere = jest.fn((condition: string | ((qb: unknown) => string)) => {
		if (typeof condition === 'function') condition(query);
		return query;
	});
	query.getRawMany = jest.fn(async () => options.intake ?? []);
	const recipients = {
		createQueryBuilder: jest.fn(() => query),
		findOne: jest.fn(async (criteria: { where: { inboxItemId: string } }) => ({
			id: `r-${criteria.where.inboxItemId}`,
			isRead: (options.readEntries ?? []).includes(criteria.where.inboxItemId)
		}))
	};
	const people = {} as Record<'select' | 'addSelect' | 'where' | 'andWhere' | 'groupBy' | 'addGroupBy' | 'orderBy' | 'limit' | 'getRawMany', jest.Mock>;
	for (const name of ['select', 'addSelect', 'where', 'andWhere', 'groupBy', 'addGroupBy', 'orderBy', 'limit'] as const) people[name] = jest.fn(() => people);
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
	const employees = { findOne: jest.fn(async (query: { where: { id: string } }) => options.employees?.[query.where.id] ?? null) };
	const notificationRows = {
		findOne: jest.fn(async (query: { where: { id: string } }) => ({
			id: query.where.id,
			isRead: (options.readNotifications ?? []).includes(query.where.id)
		}))
	};
	const dataSource = {
		getRepository: (target: unknown) => {
			if (target === InboxItemRecipient) return recipients;
			if (target === InboxDelivery) return delivery;
			if (target === InboxItem) return items;
			if (target === 'User') return users;
			if (target === 'EmployeeNotificationSetting') return settings;
			if (target === 'Employee') return employees;
			if (target === 'EmployeeNotification') return notificationRows;
			throw new Error(`Unexpected repository ${String(target)}`);
		}
	} as unknown as DataSource;
	const mailer = {
		host: () => 'https://app.test',
		sendNotification: jest.fn(async (_recipient: unknown, _line: unknown) => {
			if (options.contextFails) throw new InboxDeliveryContextUnavailableError();
			if (options.sendFails) throw new Error('SMTP refused');
		}),
		sendDigest: jest.fn(async (_recipient: unknown, _lines: unknown, _total: number) => {
			if (options.sendFails) throw new Error('SMTP refused');
		})
	};
	const pusher = {
		configured: () => true,
		send: jest.fn(async (device: { id: string }, _payload: unknown) => {
			if ((options.gone ?? []).includes(device.id)) throw new InboxPushGoneError(410);
			if ((options.refused ?? []).includes(device.id)) throw new InboxPushRefusedError('A push endpoint must not resolve to a private, loopback or link-local network.');
			if (options.pushFails) throw new Error('push service refused');
		})
	};
	const subscriptions = {
		hasAny: jest.fn(async (_tenantId: string, userId: string) => (options.devices?.[userId] ?? []).length > 0),
		devicesOf: jest.fn(async (_tenantId: string, userId: string) => options.devices?.[userId] ?? []),
		markUsed: jest.fn(async (_id: string, _now: Date) => undefined),
		gone: jest.fn(async (_id: string) => undefined),
		recordFailure: jest.fn(async (_device: unknown) => false)
	};
	const service = options.push
		? new InboxDeliveryService(dataSource, mailer as unknown as InboxDeliveryMailer, pusher as never, subscriptions as never)
		: new InboxDeliveryService(dataSource, mailer as unknown as InboxDeliveryMailer);
	return {
		service,
		query,
		delivery,
		mailer,
		users,
		settings,
		items,
		people,
		pusher,
		subscriptions,
		employees,
		recipients,
		notificationRows
	};
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
/** An entry the bridge filed for a platform notification (`n-<entry>`). */
const filedItem = (id: string, createdAt: string, type: string): Partial<InboxItem> => ({
	...item(id, createdAt, type),
	externalSource: INBOX_NOTIFICATION_EXTERNAL_SOURCE,
	externalId: `n-${id}`
});

describe('InboxDeliveryService — web push (FR-13)', () => {
	const device = (id: string) => ({ id, endpoint: `https://push.test/${id}`, p256dh: 'p', auth: 'a', failures: 0 });
	const pushRow = (id: string, userId: string, employeeId: string, notificationType = 'Mention') =>
		dueRow(id, InboxDeliveryModeEnum.IMMEDIATE, {
			userId,
			employeeId,
			channel: InboxDeliveryChannelEnum.PUSH,
			notificationType
		});

	beforeAll(() => {
		process.env['GAUZY_INBOX_WEB_PUSH_ENABLED'] = 'true';
	});
	afterAll(() => {
		delete process.env['GAUZY_INBOX_WEB_PUSH_ENABLED'];
	});

	it('decides a push beside the email for a person with a device, and none for one without', async () => {
		const { service, delivery, query } = fixture({
			push: true,
			intake: [intake(1, 'e1'), intake(2, 'e2')],
			users: { u1: user('u1'), u2: user('u2') },
			devices: { u1: [device('d1')] }
		});
		expect(await service.intake(NOW, 200)).toBe(4);
		expect(query.setParameter.mock.calls.map((call) => call[1])).toEqual([InboxDeliveryChannelEnum.EMAIL, InboxDeliveryChannelEnum.PUSH]);
		const pushes = delivery.insert.mock.calls.map((call) => call[0] as Partial<InboxDelivery>).filter((row) => row.channel === InboxDeliveryChannelEnum.PUSH);
		expect(pushes).toHaveLength(2);
		expect(pushes[0]).toMatchObject({ inboxItemId: 'i1', userId: 'u1', mode: InboxDeliveryModeEnum.IMMEDIATE, dueAt: NOW });
		expect(pushes[1]).toMatchObject({ inboxItemId: 'i2', userId: 'u2', mode: InboxDeliveryModeEnum.NONE });
	});

	it('decides no push for a timer reminder already read, holds an unread one for the wait, and pushes any other kind as before', async () => {
		const { service, delivery } = fixture({
			push: true,
			intake: [
				{ ...intake(1, 'e1', 'TimerReminder'), isRead: true },
				{ ...intake(2, 'e2', 'TimerReminder'), isRead: false },
				{ ...intake(3, 'e3'), isRead: true }
			],
			users: { u1: user('u1'), u2: user('u2'), u3: user('u3') },
			devices: { u1: [device('d1')], u2: [device('d2')], u3: [device('d3')] }
		});
		await service.intake(NOW, 200);
		const pushes = delivery.insert.mock.calls
			.map((call) => call[0] as Partial<InboxDelivery>)
			.filter((row) => row.channel === InboxDeliveryChannelEnum.PUSH);
		expect(pushes.map((row) => [row.inboxItemId, row.mode, row.dueAt])).toEqual([
			['i1', InboxDeliveryModeEnum.NONE, undefined],
			['i2', InboxDeliveryModeEnum.IMMEDIATE, AFTER_WAIT],
			// A mention read in the app is pushed as it always was
			['i3', InboxDeliveryModeEnum.IMMEDIATE, NOW]
		]);
	});

	it('serves neither channel this process is not switched to', async () => {
		const { service, delivery } = fixture({ intake: [intake(1, 'e1')], users: { u1: user('u1') } });
		// No pusher wired: email alone, as before.
		expect(await service.intake(NOW, 200)).toBe(1);
		expect(delivery.insert.mock.calls.map((call) => (call[0] as Partial<InboxDelivery>).channel)).toEqual([InboxDeliveryChannelEnum.EMAIL]);
	});

	it('pushes a due row to every device, drops a device the service no longer knows, and marks the row sent', async () => {
		const { service, pusher, subscriptions, delivery } = fixture({
			push: true,
			due: [pushRow('p1', 'u1', 'e1')],
			items: [item('i-p1', '2026-11-07T12:00:00.000Z')],
			devices: { u1: [device('d1'), device('d2')] },
			gone: ['d2'],
			employees: { e1: { lastSeenAt: new Date('2026-11-07T12:00:00.000Z'), isIdle: false } }
		});
		const outcome = await service.sendPushes(NOW, 200);
		expect(outcome).toEqual({ sent: 1, skipped: 0, failed: 0, read: 0 });
		expect(pusher.send).toHaveBeenCalledTimes(2);
		expect(pusher.send.mock.calls[0][1]).toMatchObject({ title: 'Entry i-p1', itemId: 'i-p1', tag: 'inbox-i-p1', url: expect.stringContaining('i-p1') });
		expect(subscriptions.markUsed).toHaveBeenCalledWith('d1', NOW);
		expect(subscriptions.gone).toHaveBeenCalledWith('d2');
		expect(delivery.update).toHaveBeenCalledWith({ id: expect.anything() }, expect.objectContaining({ sentAt: NOW }));
	});

	it('does not push to a person with an active, focused session, and closes the row as skipped', async () => {
		const { service, pusher, delivery } = fixture({
			push: true,
			due: [pushRow('p1', 'u1', 'e1')],
			items: [item('i-p1', '2026-11-07T12:00:00.000Z')],
			devices: { u1: [device('d1')] },
			// Active input a minute ago: a focused session. Idle, or an hour ago, would be pushed to.
			employees: { e1: { lastSeenAt: new Date('2026-11-07T12:29:00.000Z'), isIdle: false } }
		});
		expect(await service.sendPushes(NOW, 200)).toEqual({ sent: 0, skipped: 1, failed: 0, read: 0 });
		expect(pusher.send).not.toHaveBeenCalled();
		expect(delivery.update).toHaveBeenCalledWith({ id: expect.anything() }, { failedAt: NOW, lastError: INBOX_PUSH_SKIPPED_FOCUSED });
	});

	it('does not push a timer reminder read in the app before it was due, and pushes any other kind read or not', async () => {
		const { service, pusher, delivery, recipients } = fixture({
			push: true,
			due: [
				pushRow('p1', 'u1', 'e1', 'TimerReminder'),
				pushRow('p2', 'u1', 'e1', 'TimerReminder'),
				pushRow('p3', 'u1', 'e1')
			],
			items: [
				item('i-p1', '2026-11-07T12:27:00.000Z', 'TimerReminder'),
				item('i-p2', '2026-11-07T12:27:00.000Z', 'TimerReminder'),
				item('i-p3', '2026-11-07T12:00:00.000Z')
			],
			devices: { u1: [device('d1')] },
			// The tab that showed the first reminder marked it read; the mention was read in the app too
			readEntries: ['i-p1', 'i-p3']
		});
		expect(await service.sendPushes(NOW, 200)).toEqual({ sent: 2, skipped: 0, failed: 0, read: 1 });
		expect(pusher.send.mock.calls.map((call) => (call[1] as { itemId: string }).itemId)).toEqual(['i-p2', 'i-p3']);
		expect(delivery.update).toHaveBeenCalledWith(
			{ id: expect.objectContaining({ _value: ['p1'] }) },
			{ failedAt: NOW, lastError: INBOX_DELIVERY_SKIPPED_READ }
		);
		// Only the timer reminders are looked up
		expect(recipients.findOne.mock.calls.map((call) => (call[0] as { where: unknown }).where)).toEqual([
			{ inboxItemId: 'i-p1', userId: 'u1', tenantId: 'ten' },
			{ inboxItemId: 'i-p2', userId: 'u1', tenantId: 'ten' }
		]);
	});

	it('removes a device whose endpoint the policy refuses, and closes the row when no device is left', async () => {
		const { service, subscriptions, delivery, pusher } = fixture({
			push: true,
			due: [pushRow('p1', 'u1', 'e1')],
			items: [item('i-p1', '2026-11-07T12:00:00.000Z')],
			devices: { u1: [device('d1')] },
			refused: ['d1'],
			employees: { e1: { lastSeenAt: null, isIdle: true } }
		});
		expect(await service.sendPushes(NOW, 200)).toEqual({ sent: 0, skipped: 0, failed: 1, read: 0 });
		expect(pusher.send).toHaveBeenCalledTimes(1);
		expect(subscriptions.gone).toHaveBeenCalledWith('d1');
		expect(subscriptions.recordFailure).not.toHaveBeenCalled();
		expect(delivery.update).toHaveBeenCalledWith({ id: expect.anything() }, { failedAt: NOW, lastError: INBOX_PUSH_NO_SUBSCRIPTION });
	});

	it('sends no email from a process on the push switch alone, whatever email rows are due', async () => {
		const email = process.env['GAUZY_INBOX_NOTIFICATION_EMAIL_ENABLED'];
		delete process.env['GAUZY_INBOX_NOTIFICATION_EMAIL_ENABLED'];
		try {
			const { service, mailer, delivery } = fixture({
				push: true,
				due: [dueRow('m1', InboxDeliveryModeEnum.IMMEDIATE), dueRow('m2', InboxDeliveryModeEnum.DIGEST)],
				items: [item('i-m1', '2026-11-07T12:00:00.000Z'), item('i-m2', '2026-11-07T11:00:00.000Z')],
				users: { u1: user('u1') }
			});
			expect(await service.sendImmediate(NOW, 200)).toEqual({ sent: 0, failed: 0, read: 0 });
			expect(await service.sendDigests(NOW, 200)).toEqual({ sent: 0, failed: 0, read: 0 });
			expect(mailer.sendNotification).not.toHaveBeenCalled();
			expect(mailer.sendDigest).not.toHaveBeenCalled();
			expect(delivery.update).not.toHaveBeenCalled();
		} finally {
			process.env['GAUZY_INBOX_NOTIFICATION_EMAIL_ENABLED'] = email;
		}
	});

	it('closes a row whose person has no device left, and tries again later one every device refused', async () => {
		const none = fixture({ push: true, due: [pushRow('p1', 'u1', 'e1')], items: [item('i-p1', '2026-11-07T12:00:00.000Z')], employees: { e1: { lastSeenAt: null, isIdle: true } } });
		expect(await none.service.sendPushes(NOW, 200)).toEqual({ sent: 0, skipped: 0, failed: 1, read: 0 });
		expect(none.delivery.update).toHaveBeenCalledWith({ id: expect.anything() }, { failedAt: NOW, lastError: INBOX_PUSH_NO_SUBSCRIPTION });

		const refused = fixture({ push: true, due: [pushRow('p1', 'u1', 'e1')], items: [item('i-p1', '2026-11-07T12:00:00.000Z')], devices: { u1: [device('d1')] }, pushFails: true });
		expect(await refused.service.sendPushes(NOW, 200)).toEqual({ sent: 0, skipped: 0, failed: 1, read: 0 });
		expect(refused.subscriptions.recordFailure).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1' }));
		expect(refused.delivery.update).toHaveBeenCalledWith({ id: expect.anything() }, expect.objectContaining({ attempts: 1, nextAttemptAt: new Date('2026-11-07T12:35:00.000Z') }));
	});
});

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

	it('decides nothing for a timer reminder already read, whichever way the driver answers the flag, and holds an unread one for the wait', async () => {
		// A timer reminder an open Ever Teams tab showed itself is filed read: the Inbox keeps it, no email follows
		const { service, delivery, query } = fixture({
			intake: [
				{ ...intake(1, 'e1', 'TimerReminder'), isRead: true },
				{ ...intake(2, 'e2', 'TimerReminder'), isRead: 1 },
				{ ...intake(3, 'e3', 'TimerReminder'), isRead: 0 }
			],
			users: { u1: user('u1'), u2: user('u2'), u3: user('u3') }
		});
		expect(await service.intake(NOW, 200)).toBe(3);
		expect(query.addSelect).toHaveBeenCalledWith('recipient.isRead', 'isRead');
		const written = delivery.insert.mock.calls.map((call) => call[0] as Partial<InboxDelivery>);
		expect(written.map((row) => [row.inboxItemId, row.mode])).toEqual([
			['i1', InboxDeliveryModeEnum.NONE],
			['i2', InboxDeliveryModeEnum.NONE],
			['i3', InboxDeliveryModeEnum.IMMEDIATE]
		]);
		// Unread: emailed once the wait is over, unless an Ever Teams tab that showed it marks it read by then
		expect(written[2]).toMatchObject({ notificationType: 'TimerReminder', dueAt: AFTER_WAIT });
	});

	it('decides every other kind as it always did, whether its entry was read or not', async () => {
		const { service, delivery } = fixture({
			intake: [
				{ ...intake(1, 'e1'), isRead: true },
				{ ...intake(2, 'e2'), isRead: 1 },
				{ ...intake(3, 'e3', 'Comment'), isRead: true },
				{ ...intake(4, 'e4'), isRead: false }
			],
			users: { u1: user('u1'), u2: user('u2'), u3: user('u3'), u4: user('u4') },
			settings: { e3: { preferences: { email: 'digest', digestHour: 8 } } }
		});
		expect(await service.intake(NOW, 200)).toBe(4);
		const written = delivery.insert.mock.calls.map((call) => call[0] as Partial<InboxDelivery>);
		expect(written.map((row) => [row.inboxItemId, row.mode, row.dueAt])).toEqual([
			['i1', InboxDeliveryModeEnum.IMMEDIATE, NOW],
			['i2', InboxDeliveryModeEnum.IMMEDIATE, NOW],
			['i3', InboxDeliveryModeEnum.DIGEST, new Date('2026-11-08T06:00:00.000Z')],
			['i4', InboxDeliveryModeEnum.IMMEDIATE, NOW]
		]);
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
		expect(await service.sendImmediate(NOW, 200)).toEqual({ sent: 1, failed: 0, read: 0 });
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

	it('sends no email for a timer reminder read in the app before it was due, and closes its row', async () => {
		const { service, delivery, mailer } = fixture({
			due: [
				dueRow('d1', InboxDeliveryModeEnum.IMMEDIATE, { notificationType: 'TimerReminder' }),
				dueRow('d2', InboxDeliveryModeEnum.IMMEDIATE, { notificationType: 'TimerReminder', userId: 'u2' })
			],
			items: [
				item('i-d1', '2026-11-07T12:27:00.000Z', 'TimerReminder'),
				item('i-d2', '2026-11-07T12:27:00.000Z', 'TimerReminder')
			],
			users: { u1: user('u1'), u2: user('u2') },
			// The first person's Ever Teams tab showed the reminder and marked it read; the second had no tab open
			readEntries: ['i-d1']
		});
		expect(await service.sendImmediate(NOW, 200)).toEqual({ sent: 1, failed: 0, read: 1 });
		expect(mailer.sendNotification).toHaveBeenCalledTimes(1);
		expect(mailer.sendNotification.mock.calls[0][1]).toMatchObject({ itemId: 'i-d2', kindLabel: 'Timer reminder' });
		expect(delivery.update.mock.calls[0]).toEqual([
			{ id: expect.objectContaining({ _value: ['d1'] }) },
			{ failedAt: NOW, lastError: INBOX_DELIVERY_SKIPPED_READ }
		]);
		expect(delivery.update.mock.calls[1][1]).toMatchObject({ sentAt: NOW });
	});

	it("sends no email for a timer reminder marked read through the notification API that its entry's row missed", async () => {
		const { service, mailer, notificationRows } = fixture({
			due: [
				dueRow('d1', InboxDeliveryModeEnum.IMMEDIATE, { notificationType: 'TimerReminder' }),
				dueRow('d2', InboxDeliveryModeEnum.IMMEDIATE, { notificationType: 'TimerReminder', userId: 'u2' })
			],
			items: [
				filedItem('i-d1', '2026-11-07T12:27:00.000Z', 'TimerReminder'),
				filedItem('i-d2', '2026-11-07T12:27:00.000Z', 'TimerReminder')
			],
			users: { u1: user('u1'), u2: user('u2') },
			// The tab's mark landed on the notification while its entry was being filed: the entry's row is still unread
			readNotifications: ['n-i-d1']
		});
		expect(await service.sendImmediate(NOW, 200)).toEqual({ sent: 1, failed: 0, read: 1 });
		expect(mailer.sendNotification.mock.calls.map((call) => (call[1] as { itemId: string }).itemId)).toEqual([
			'i-d2'
		]);
		// Read in the row's own tenant
		expect(notificationRows.findOne.mock.calls[0][0]).toMatchObject({ where: { id: 'n-i-d1', tenantId: 'ten' } });
	});

	it('emails every other kind whether its entry was read or not, without looking it up', async () => {
		const { service, mailer, recipients } = fixture({
			due: [
				dueRow('d1', InboxDeliveryModeEnum.IMMEDIATE, { notificationType: 'Mention' }),
				dueRow('d2', InboxDeliveryModeEnum.IMMEDIATE)
			],
			items: [item('i-d1', '2026-11-07T12:00:00.000Z'), item('i-d2', '2026-11-07T12:00:00.000Z')],
			users: { u1: user('u1') },
			readEntries: ['i-d1', 'i-d2']
		});
		expect(await service.sendImmediate(NOW, 200)).toEqual({ sent: 2, failed: 0, read: 0 });
		expect(mailer.sendNotification).toHaveBeenCalledTimes(2);
		expect(recipients.findOne).not.toHaveBeenCalled();
	});

	it('gives up on a row whose user has no email address, or whose entry is gone', async () => {
		const { service, delivery, mailer } = fixture({
			due: [dueRow('d1', InboxDeliveryModeEnum.IMMEDIATE), dueRow('d2', InboxDeliveryModeEnum.IMMEDIATE, { userId: 'u2', inboxItemId: 'gone' })],
			items: [item('i-d1', '2026-11-07T12:00:00.000Z')],
			users: { u1: user('u1', null), u2: user('u2') }
		});
		expect(await service.sendImmediate(NOW, 200)).toEqual({ sent: 0, failed: 2, read: 0 });
		expect(mailer.sendNotification).not.toHaveBeenCalled();
		expect(delivery.update.mock.calls.map((call) => (call[1] as { lastError: string }).lastError)).toEqual(['The user has no email address.', 'The entry is gone.']);
		expect(delivery.update.mock.calls.every((call) => (call[1] as { failedAt?: Date }).failedAt === NOW)).toBe(true);
	});

	it('raises the process\'s own context failure as the sweep\'s, leaving the rows untouched', async () => {
		const { service, delivery } = fixture({ due: [dueRow('d1', InboxDeliveryModeEnum.IMMEDIATE)], items: [item('i-d1', '2026-11-07T12:00:00.000Z')], users: { u1: user('u1') }, contextFails: true });
		await expect(service.sendImmediate(NOW, 200)).rejects.toBeInstanceOf(InboxDeliveryContextUnavailableError);
		expect(delivery.update).not.toHaveBeenCalled();
	});

	it('records a failed attempt with a later next attempt, and gives up after the fifth', async () => {
		const first = fixture({ due: [dueRow('d1', InboxDeliveryModeEnum.IMMEDIATE)], items: [item('i-d1', '2026-11-07T12:00:00.000Z')], users: { u1: user('u1') }, sendFails: true });
		expect(await first.service.sendImmediate(NOW, 200)).toEqual({ sent: 0, failed: 1, read: 0 });
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
		expect(await service.sendDigests(NOW, 200)).toEqual({ sent: 2, failed: 0, read: 0 });
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

	it('leaves out of the digest a timer reminder read in the app meanwhile, and keeps every other kind, read or not', async () => {
		const { service, delivery, mailer } = fixture({
			due: [
				dueRow('a', InboxDeliveryModeEnum.DIGEST, { notificationType: 'TimerReminder' }),
				dueRow('b', InboxDeliveryModeEnum.DIGEST, { notificationType: 'Comment' }),
				dueRow('c', InboxDeliveryModeEnum.DIGEST, { notificationType: 'TimerReminder', userId: 'u2' })
			],
			items: [
				item('i-a', '2026-11-07T08:00:00.000Z', 'TimerReminder'),
				item('i-b', '2026-11-07T09:00:00.000Z', 'Comment'),
				item('i-c', '2026-11-07T08:00:00.000Z', 'TimerReminder')
			],
			users: { u1: user('u1'), u2: user('u2') },
			readEntries: ['i-a', 'i-b', 'i-c']
		});
		// The first person's digest lists the comment alone; the second person's has nothing left to send
		expect(await service.sendDigests(NOW, 200)).toEqual({ sent: 1, failed: 0, read: 2 });
		expect(mailer.sendDigest).toHaveBeenCalledTimes(1);
		const [, lines, total] = mailer.sendDigest.mock.calls[0] as unknown as [
			unknown,
			Array<{ itemId: string }>,
			number
		];
		expect(lines.map((line) => line.itemId)).toEqual(['i-b']);
		expect(total).toBe(1);
		const skipped = delivery.update.mock.calls.filter(
			(call) => (call[1] as { lastError?: string }).lastError === INBOX_DELIVERY_SKIPPED_READ
		);
		expect(skipped.map((call) => call[0])).toEqual([
			{ id: expect.objectContaining({ _value: ['a'] }) },
			{ id: expect.objectContaining({ _value: ['c'] }) }
		]);
	});

	it('keeps the whole digest for a later attempt when its email fails, and drops only the entries that are gone', async () => {
		const { service, delivery, mailer } = fixture({
			due: [dueRow('a', InboxDeliveryModeEnum.DIGEST), dueRow('b', InboxDeliveryModeEnum.DIGEST, { inboxItemId: 'gone' })],
			items: [item('i-a', '2026-11-07T08:00:00.000Z')],
			users: { u1: user('u1') },
			sendFails: true
		});
		expect(await service.sendDigests(NOW, 200)).toEqual({ sent: 0, failed: 1, read: 0 });
		expect(mailer.sendDigest).toHaveBeenCalledTimes(1);
		const gone = delivery.update.mock.calls.find((call) => (call[1] as { lastError?: string }).lastError === 'The entry is gone.');
		expect(gone?.[0]).toEqual({ id: expect.objectContaining({ _value: ['b'] }) });
		const failed = delivery.update.mock.calls.find((call) => (call[1] as { lastError?: string }).lastError === 'SMTP refused');
		expect(failed?.[0]).toEqual({ id: expect.objectContaining({ _value: ['a'] }) });
		expect(failed?.[1]).toMatchObject({ attempts: 1 });
	});
});
