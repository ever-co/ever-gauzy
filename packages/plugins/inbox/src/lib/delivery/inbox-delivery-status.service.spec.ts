const mockContext: { tenantId: string | null; organizationId: string | null } = { tenantId: 'tenant-1', organizationId: 'org-1' };

jest.mock('@gauzy/core', () => ({
	EmailSendService: class EmailSendService {},
	MikroOrmBaseEntityRepository: class MikroOrmBaseEntityRepository {},
	MultiORMColumn: () => () => undefined,
	MultiORMEntity: () => () => undefined,
	TenantOrganizationBaseEntity: class TenantOrganizationBaseEntity {},
	RequestContext: {
		currentTenantId: () => mockContext.tenantId,
		currentOrganizationId: () => mockContext.organizationId
	}
}));

import {
	INBOX_DELIVERY_STATUS_HISTORY_ROWS,
	INBOX_DELIVERY_STATUS_AVAILABLE_TTL_MS,
	INBOX_DELIVERY_STATUS_CHECK_TIMEOUT_MS,
	INBOX_DELIVERY_STATUS_UNAVAILABLE_TTL_MS,
	InboxDeliveryStatusService
} from './inbox-delivery-status.service';

const FLAGS = ['GAUZY_INBOX_NOTIFICATION_EMAIL_ENABLED', 'GAUZY_INBOX_WEB_PUSH_ENABLED', 'GAUZY_INBOX_VAPID_PUBLIC_KEY', 'GAUZY_INBOX_VAPID_PRIVATE_KEY', 'GAUZY_INBOX_ENABLED'];

interface IHistoryRow {
	userId?: string;
	updatedAt?: Date;
	sentAt?: Date | null;
	lastError?: string | null;
	attempts?: number;
}

/** The service over a stub transport lookup, a delivery log (newest first) and a clock the spec moves. */
function build(answer: () => Promise<unknown>, history: IHistoryRow[] | (() => Promise<IHistoryRow[]>) = []) {
	const clock = { now: Date.parse('2026-11-11T12:00:00Z') };
	const sender = { getEmailInstance: jest.fn(answer) };
	// The log as the query reads it: newest `updatedAt` first, then the limit.
	const find = jest.fn(async (options?: { take?: number }) => {
		const rows = typeof history === 'function' ? await history() : history;
		const newestFirst = [...rows].sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0));
		return newestFirst.slice(0, options?.take ?? newestFirst.length);
	});
	const dataSource = { getRepository: () => ({ find }) };
	const service = new InboxDeliveryStatusService(sender as never, dataSource as never);
	(service as unknown as { now: () => number }).now = () => clock.now;
	return { service, sender, clock, find };
}

let attempt = 0;
/** A failed send of its own (another moment), unless the row shares one. */
const failed = (error = 'Invalid API key', at?: Date, userId = 'person-1'): IHistoryRow => ({
	userId,
	updatedAt: at ?? new Date(Date.parse('2026-11-11T11:00:00Z') - (attempt += 1) * 60_000),
	sentAt: null,
	lastError: error,
	attempts: 1
});
/** A send that went out, at `at` (by default before every failure the other helpers make). */
const sent = (at = new Date('2026-11-11T07:00:00Z'), userId = 'person-1'): IHistoryRow => ({
	userId,
	updatedAt: at,
	sentAt: at,
	lastError: null,
	attempts: 1
});
const skipped = (): IHistoryRow => ({ sentAt: null, lastError: 'The person has no email address', attempts: 0 });

describe('InboxDeliveryStatusService', () => {
	const saved: Record<string, string | undefined> = {};

	beforeEach(() => {
		for (const name of FLAGS) saved[name] = process.env[name];
		process.env['GAUZY_INBOX_ENABLED'] = 'true';
		process.env['GAUZY_INBOX_NOTIFICATION_EMAIL_ENABLED'] = 'true';
		delete process.env['GAUZY_INBOX_WEB_PUSH_ENABLED'];
		delete process.env['GAUZY_INBOX_VAPID_PUBLIC_KEY'];
		delete process.env['GAUZY_INBOX_VAPID_PRIVATE_KEY'];
	});

	afterEach(() => {
		for (const name of FLAGS) {
			if (saved[name] === undefined) delete process.env[name];
			else process.env[name] = saved[name];
		}
		mockContext.tenantId = 'tenant-1';
		mockContext.organizationId = 'org-1';
		jest.useRealTimers();
	});

	it('reports email as available when a transport answers for the tenant and organization', async () => {
		const { service, sender } = build(async () => ({ send: jest.fn() }));

		const status = await service.status();

		expect(status.email).toEqual({ enabled: true, available: true });
		expect(status.push).toEqual({ enabled: false, available: false });
		expect(status.checkedAt).toBe('2026-11-11T12:00:00.000Z');
		expect(sender.getEmailInstance).toHaveBeenCalledWith({ tenantId: 'tenant-1', organizationId: 'org-1' });
	});

	it('reports email as unavailable when no transport answers, without revealing why', async () => {
		const { service } = build(async () => {
			throw new Error('connect ECONNREFUSED smtp.internal:25');
		});

		const status = await service.status();

		expect(status.email).toEqual({ enabled: true, available: false });
		expect(JSON.stringify(status)).not.toContain('smtp.internal');
	});

	it('checks nothing while the email flag is off', async () => {
		process.env['GAUZY_INBOX_NOTIFICATION_EMAIL_ENABLED'] = 'false';
		const { service, sender } = build(async () => ({}));

		expect((await service.status()).email).toEqual({ enabled: false, available: false });
		expect(sender.getEmailInstance).not.toHaveBeenCalled();
	});

	it('caches a check per scope, and checks a missing transport again sooner than a working one', async () => {
		let works = true;
		const { service, sender, clock } = build(async () => {
			if (!works) throw new Error('down');
			return {};
		});

		await service.status();
		await service.status();
		expect(sender.getEmailInstance).toHaveBeenCalledTimes(1);

		// Another organization is its own scope.
		mockContext.organizationId = 'org-2';
		await service.status();
		expect(sender.getEmailInstance).toHaveBeenCalledTimes(2);

		mockContext.organizationId = 'org-1';
		works = false;
		clock.now += INBOX_DELIVERY_STATUS_AVAILABLE_TTL_MS + 1;
		expect((await service.status()).email.available).toBe(false);
		expect(sender.getEmailInstance).toHaveBeenCalledTimes(3);

		works = true;
		clock.now += INBOX_DELIVERY_STATUS_UNAVAILABLE_TTL_MS + 1;
		expect((await service.status()).email.available).toBe(true);
		expect(sender.getEmailInstance).toHaveBeenCalledTimes(4);
	});

	it('runs one check at a time per scope', async () => {
		let release: (value: unknown) => void = () => undefined;
		const { service, sender } = build(() => new Promise((resolve) => (release = resolve)));

		const first = service.status();
		const second = service.status();
		release({});

		expect((await first).email.available).toBe(true);
		expect((await second).email.available).toBe(true);
		expect(sender.getEmailInstance).toHaveBeenCalledTimes(1);
	});

	it('counts a transport that does not answer in time as unavailable', async () => {
		jest.useFakeTimers();
		const { service } = build(() => new Promise(() => undefined));

		const pending = service.status();
		await jest.advanceTimersByTimeAsync(INBOX_DELIVERY_STATUS_CHECK_TIMEOUT_MS + 1);

		expect((await pending).email).toEqual({ enabled: true, available: false });
	});

	it('reports web push as available only with the flag and both keys', async () => {
		process.env['GAUZY_INBOX_WEB_PUSH_ENABLED'] = 'true';
		const { service } = build(async () => ({}));
		expect((await service.status()).push).toEqual({ enabled: true, available: false });

		process.env['GAUZY_INBOX_VAPID_PUBLIC_KEY'] = 'public';
		process.env['GAUZY_INBOX_VAPID_PRIVATE_KEY'] = 'private';
		expect((await service.status()).push).toEqual({ enabled: true, available: true });
	});

	it('answers without a check when the request has no tenant', async () => {
		mockContext.tenantId = null;
		const { service, sender } = build(async () => ({}));

		expect((await service.status()).email).toEqual({ enabled: true, available: false });
		expect(sender.getEmailInstance).not.toHaveBeenCalled();
	});

	it('reports email as unavailable when the latest sends of the scope keep failing, though the transport answers', async () => {
		// A provider account answers without a check of its own: a revoked key shows only when it sends.
		const { service, find } = build(async () => ({}), [failed(), failed(), failed(), sent()]);

		expect((await service.status()).email).toEqual({ enabled: true, available: false });
		expect(find).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.arrayContaining([expect.objectContaining({ tenantId: 'tenant-1', organizationId: 'org-1', channel: 'email' })]),
				order: { updatedAt: 'DESC' }
			})
		);
	});

	it('keeps email available after a failure or two, after a send that went out since, and over skipped deliveries', async () => {
		const at = (time: string) => new Date(`2026-11-11T${time}:00Z`);
		// Two failures, then (older) a send that went out, then older failures: only the two newest count.
		const history = [failed('x', at('10:50')), failed('x', at('10:40')), sent(at('10:30')), failed('x', at('10:20')), failed('x', at('10:10'))];
		expect((await build(async () => ({}), history).service.status()).email.available).toBe(true);
		expect((await build(async () => ({}), [failed('Recipient refused', at('10:50')), sent(at('10:00'))]).service.status()).email.available).toBe(true);
		// The query's order decides, not the order rows come in: the same rows shuffled answer the same.
		expect((await build(async () => ({}), [...history].reverse()).service.status()).email.available).toBe(true);
		expect((await build(async () => ({}), [skipped(), skipped(), skipped(), failed()]).service.status()).email.available).toBe(true);
	});

	it('counts a failed digest once, however many entries it carried', async () => {
		const digestAt = new Date('2026-11-11T08:00:00Z');
		const digest = [failed('Recipient refused', digestAt), failed('Recipient refused', digestAt), failed('Recipient refused', digestAt)];

		expect((await build(async () => ({}), digest).service.status()).email.available).toBe(true);
		// Three people refused at the same moment are three sends.
		const three = [failed('x', digestAt, 'a'), failed('x', digestAt, 'b'), failed('x', digestAt, 'c')];
		expect((await build(async () => ({}), three).service.status()).email.available).toBe(false);
	});

	it('counts a delivery log read that does not answer in time as unavailable, like the lookup', async () => {
		jest.useFakeTimers();
		const { service } = build(async () => ({}), () => new Promise(() => undefined));

		const pending = service.status();
		await jest.advanceTimersByTimeAsync(INBOX_DELIVERY_STATUS_CHECK_TIMEOUT_MS + 1);

		expect((await pending).email).toEqual({ enabled: true, available: false });
	});

	it('sees the failures before a large failed digest: three full digests fit in what is read', async () => {
		const digest = (at: string, size: number) => Array.from({ length: size }, () => failed('Refused', new Date(at)));
		const history = [...digest('2026-11-11T10:00:00Z', 50), ...digest('2026-11-11T09:00:00Z', 50), ...digest('2026-11-11T08:00:00Z', 50), sent()];
		const { service, find } = build(async () => ({}), async () => history.slice(0, INBOX_DELIVERY_STATUS_HISTORY_ROWS));

		expect((await service.status()).email.available).toBe(false);
		// Only attempted rows are read: sent ones, and failed sends.
		const options = (find.mock.calls as unknown as Array<[{ where: Array<Record<string, unknown>>; take: number }]>)[0][0];
		expect(options.take).toBe(INBOX_DELIVERY_STATUS_HISTORY_ROWS);
		expect(options.where).toHaveLength(2);
	});

	it('does not start another check of a scope while one is still stuck, and reports it unavailable', async () => {
		jest.useFakeTimers();
		const { service, sender, clock } = build(() => new Promise(() => undefined));

		const first = service.status();
		await jest.advanceTimersByTimeAsync(INBOX_DELIVERY_STATUS_CHECK_TIMEOUT_MS + 1);
		expect((await first).email.available).toBe(false);

		clock.now += INBOX_DELIVERY_STATUS_UNAVAILABLE_TTL_MS + 1;
		expect((await service.status()).email.available).toBe(false);
		expect(sender.getEmailInstance).toHaveBeenCalledTimes(1);
	});

	it('lets the transport answer stand when the delivery log cannot be read', async () => {
		const { service } = build(async () => ({}), async () => {
			throw new Error('relation "inbox_delivery" does not exist');
		});

		expect((await service.status()).email).toEqual({ enabled: true, available: true });
	});
});
