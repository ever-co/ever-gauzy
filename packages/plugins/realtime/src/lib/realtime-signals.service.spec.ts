/**
 * Presence as the organization hears of it: each report goes to the per-connection store, and `presence.changed` is
 * published only when the employee's merged presence changed — on a report, or when a sweep finds a connection that
 * lapsed. `@gauzy/core` is doubled at the module boundary (its barrel boots the whole application).
 */
const mockContext = { user: { employeeId: 'e1' } as { employeeId?: string } | null, userId: 'u1' as string | null, tenantId: 'ten' as string | null, organizationId: 'org' as string | null };
jest.mock('@gauzy/core', () => {
	const explicit: Record<string, unknown> = {
		__esModule: true,
		// The plugin's entities load with the services: their decorators are no-ops here.
		MultiORMColumn: () => () => undefined,
		MultiORMEntity: () => () => undefined,
		ColumnIndex: () => () => undefined,
		RequestContext: {
			currentUser: () => mockContext.user,
			currentUserId: () => mockContext.userId,
			currentTenantId: () => mockContext.tenantId,
			currentOrganizationId: () => mockContext.organizationId
		}
	};
	return new Proxy(explicit, { get: (target, name) => (name in target ? target[name as string] : function Anything() {
		return undefined;
	}) });
});

import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RealtimePresenceStatus } from '@gauzy/contracts';
import type { GraphqlPubSub } from '@gauzy/core';
import { REALTIME_SHARED_CONNECTION_KEY } from './realtime.entities';
import { IPresenceOutcome, RealtimePresenceStore } from './realtime-presence.store';
import { RealtimeSignalsService } from './realtime-signals.service';

const outcome = (overrides: Partial<IPresenceOutcome> = {}): IPresenceOutcome => ({
	tenantId: 'ten',
	organizationId: 'org',
	employeeId: 'e1',
	userId: 'u1',
	status: RealtimePresenceStatus.ACTIVE,
	changed: true,
	revision: 3,
	...overrides
});

/** A store sweep that hands over these outcomes, as the store does once each employee committed. */
const sweepOf = (outcomes: IPresenceOutcome[]) =>
	jest.fn(async (_now: Date, settled: (outcome: IPresenceOutcome) => Promise<void>) => {
		for (const each of outcomes) await settled(each);
		return { settled: outcomes.length, failed: 0 };
	});

function signalsOver(store: Partial<Record<'report' | 'sweep' | 'claimPublication' | 'untold' | 'release', jest.Mock>>) {
	const pubSub = { publish: jest.fn(async () => undefined) };
	// By default this process wins every window, and nothing is left untold.
	const doubles = {
		claimPublication: jest.fn(async (scope: IPresenceOutcome) => ({ kind: 'publish', outcome: scope, claim: { id: 'p1' } })),
		untold: jest.fn(async () => []),
		release: jest.fn(async () => true),
		...store
	};
	const service = new RealtimeSignalsService({} as DataSource, doubles as unknown as RealtimePresenceStore, pubSub as unknown as GraphqlPubSub);
	return { service, pubSub, store: doubles };
}

describe('RealtimeSignalsService presence', () => {
	beforeEach(() => {
		Object.assign(mockContext, { user: { employeeId: 'e1' }, userId: 'u1', tenantId: 'ten', organizationId: 'org' });
	});

	it('reports the connection the client names, and tells the organization of a change', async () => {
		const report = jest.fn(async () => outcome());
		const { service, pubSub } = signalsOver({ report });
		const presence = await service.publishPresence({ status: RealtimePresenceStatus.ACTIVE, connectionId: 'tab-1' });
		expect(report).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'ten', organizationId: 'org', employeeId: 'e1', userId: 'u1', connectionId: 'tab-1', status: 'active' }));
		expect(presence).toMatchObject({ employeeId: 'e1', userId: 'u1', organizationId: 'org', status: 'active', revision: 3 });
		expect(pubSub.publish).toHaveBeenCalledWith(
			'presence.changed',
			'ten',
			expect.objectContaining({
				name: 'presence.changed',
				tenantId: 'ten',
				organizationId: 'org',
				aggregate: { type: 'employee', id: 'e1' },
				// The event's time is when it was told (the claim); the answer's, when the report was merged.
				data: { ...presence, at: expect.any(String) }
			})
		);
	});

	it('answers the merged presence and tells nobody when it did not change (another tab still decides it)', async () => {
		const report = jest.fn(async () => outcome({ status: RealtimePresenceStatus.ACTIVE, changed: false }));
		const { service, pubSub } = signalsOver({ report });
		const presence = await service.publishPresence({ status: RealtimePresenceStatus.OFFLINE, connectionId: 'tab-2' });
		expect(presence.status).toBe('active');
		expect(pubSub.publish).not.toHaveBeenCalled();
	});

	it('reports a client that names no connection under the shared one', async () => {
		const report = jest.fn(async () => outcome());
		const { service } = signalsOver({ report });
		await service.publishPresence({ status: RealtimePresenceStatus.IDLE });
		expect(report).toHaveBeenCalledWith(expect.objectContaining({ connectionId: REALTIME_SHARED_CONNECTION_KEY, status: 'idle' }));
	});

	it('refuses a caller without an employee, a user or a tenant', async () => {
		const { service } = signalsOver({ report: jest.fn() });
		mockContext.user = null;
		await expect(service.publishPresence({ status: RealtimePresenceStatus.ACTIVE })).rejects.toBeInstanceOf(ForbiddenException);
		Object.assign(mockContext, { user: { employeeId: 'e1' }, tenantId: null });
		await expect(service.publishPresence({ status: RealtimePresenceStatus.ACTIVE })).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('tells each organization of the lapsed connections a sweep settled, outside any request', async () => {
		const sweep = sweepOf([outcome({ employeeId: 'e2', userId: 'u2', organizationId: 'org-2', status: RealtimePresenceStatus.OFFLINE }), outcome({ changed: false })]);
		const { service, pubSub } = signalsOver({ sweep });
		// No request context: the scope comes from the settled rows.
		Object.assign(mockContext, { user: null, userId: null, tenantId: null, organizationId: null });
		const now = new Date('2026-11-09T12:00:00.000Z');
		await service.sweepPresence(now);
		expect(sweep).toHaveBeenCalledWith(now, expect.any(Function));
		expect(pubSub.publish).toHaveBeenCalledTimes(1);
		expect(pubSub.publish).toHaveBeenCalledWith(
			'presence.changed',
			'ten',
			expect.objectContaining({ organizationId: 'org-2', data: expect.objectContaining({ employeeId: 'e2', status: 'offline', at: expect.any(String) }) })
		);
	});

	it('runs one sweep at a time and survives a failed one', async () => {
		let release: () => void = () => undefined;
		const sweep = jest
			.fn()
			.mockImplementationOnce(() => new Promise((resolve) => (release = () => resolve({ settled: 0, failed: 0 }))))
			.mockImplementationOnce(async () => Promise.reject(new Error('database unavailable')))
			.mockImplementation(async () => ({ settled: 0, failed: 0 }));
		const { service } = signalsOver({ sweep });
		const first = service.sweepPresence();
		await service.sweepPresence();
		expect(sweep).toHaveBeenCalledTimes(1);
		release();
		await first;
		await expect(service.sweepPresence()).resolves.toBeUndefined();
		await service.sweepPresence();
		expect(sweep).toHaveBeenCalledTimes(3);
	});

	describe('the publication window', () => {
		afterEach(() => jest.useRealTimers());

		it('tells the latest state once the window closes when another change holds it, with one timer per employee', async () => {
			jest.useFakeTimers({ now: new Date('2026-11-10T12:00:00.000Z') });
			const latest = outcome({ status: RealtimePresenceStatus.AWAY, revision: 7 });
			const claimPublication = jest
				.fn()
				.mockResolvedValueOnce({ kind: 'later', at: Date.now() + 4_000 })
				.mockResolvedValueOnce({ kind: 'later', at: Date.now() + 4_000 })
				.mockResolvedValue({ kind: 'publish', outcome: latest });
			const { service, pubSub } = signalsOver({ report: jest.fn(async () => outcome()), claimPublication });
			await service.publishPresence({ status: RealtimePresenceStatus.ACTIVE, connectionId: 'tab-1' });
			await service.publishPresence({ status: RealtimePresenceStatus.IDLE, connectionId: 'tab-1' });
			expect(pubSub.publish).not.toHaveBeenCalled();
			await jest.advanceTimersByTimeAsync(4_000);
			expect(claimPublication).toHaveBeenCalledTimes(3);
			expect(pubSub.publish).toHaveBeenCalledTimes(1);
			expect(pubSub.publish).toHaveBeenCalledWith('presence.changed', 'ten', expect.objectContaining({ data: expect.objectContaining({ status: 'away', revision: 7 }) }));
		});

		it('tells nothing when another process already told it, and survives a failing claim', async () => {
			const claimPublication = jest
				.fn()
				.mockResolvedValueOnce({ kind: 'none' })
				.mockRejectedValueOnce(new Error('database unavailable'));
			const { service, pubSub } = signalsOver({ report: jest.fn(async () => outcome()), claimPublication });
			await expect(service.publishPresence({ status: RealtimePresenceStatus.ACTIVE })).resolves.toMatchObject({ status: 'active' });
			await expect(service.publishPresence({ status: RealtimePresenceStatus.ACTIVE })).resolves.toMatchObject({ status: 'active' });
			expect(pubSub.publish).not.toHaveBeenCalled();
		});

		it('lets the sweep tell what no process told', async () => {
			const untold = jest.fn(async () => [{ tenantId: 'ten', employeeId: 'e9' }]);
			const claimPublication = jest.fn(async () => ({ kind: 'publish', outcome: outcome({ employeeId: 'e9', userId: 'u9' }) }));
			const { service, pubSub } = signalsOver({ sweep: sweepOf([]), untold, claimPublication });
			await service.sweepPresence(new Date('2026-11-10T12:00:00.000Z'));
			expect(claimPublication).toHaveBeenCalledWith({ tenantId: 'ten', employeeId: 'e9' }, expect.any(Date));
			expect(pubSub.publish).toHaveBeenCalledWith('presence.changed', 'ten', expect.objectContaining({ data: expect.objectContaining({ employeeId: 'e9' }) }));
		});

		it('claims with the moment of the claim, not the start of a report that waited on the database', async () => {
			jest.useFakeTimers({ now: new Date('2026-11-10T12:00:00.000Z') });
			// The report takes 4 s (a lock wait) before it hands its outcome over.
			const report = jest.fn(async () => {
				jest.setSystemTime(new Date('2026-11-10T12:00:04.000Z'));
				return outcome();
			});
			const claimPublication = jest.fn(async (scope: IPresenceOutcome) => ({ kind: 'publish', outcome: scope }));
			const { service } = signalsOver({ report, claimPublication });
			await service.publishPresence({ status: RealtimePresenceStatus.ACTIVE });
			expect((claimPublication.mock.calls[0] as unknown[])[1]).toEqual(new Date('2026-11-10T12:00:04.000Z'));
		});

		it('neither publishes nor schedules after the module stopped, even for a claim in flight', async () => {
			jest.useFakeTimers();
			let answer: (value: unknown) => void = () => undefined;
			const claimPublication = jest
				.fn()
				.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)))
				.mockResolvedValue({ kind: 'publish', outcome: outcome() });
			const { service, pubSub } = signalsOver({ report: jest.fn(async () => outcome()), claimPublication });
			const reporting = service.publishPresence({ status: RealtimePresenceStatus.ACTIVE });
			await Promise.resolve();
			service.onModuleDestroy();
			answer({ kind: 'later', at: Date.now() + 1_000 });
			await reporting;
			await jest.advanceTimersByTimeAsync(10_000);
			expect(claimPublication).toHaveBeenCalledTimes(1);
			expect(pubSub.publish).not.toHaveBeenCalled();
			// A report after the stop claims nothing.
			await service.publishPresence({ status: RealtimePresenceStatus.ACTIVE });
			expect(claimPublication).toHaveBeenCalledTimes(1);
		});

		it('claims nothing in a process without a pub/sub, so a process that has one tells the change', async () => {
			const claimPublication = jest.fn();
			const untold = jest.fn(async () => [outcome()]);
			const doubles = { report: jest.fn(async () => outcome()), sweep: jest.fn(async () => undefined), claimPublication, untold, release: jest.fn() };
			const service = new RealtimeSignalsService({} as DataSource, doubles as unknown as RealtimePresenceStore, undefined);
			await expect(service.publishPresence({ status: RealtimePresenceStatus.ACTIVE })).resolves.toMatchObject({ status: 'active' });
			await service.sweepPresence();
			expect(claimPublication).not.toHaveBeenCalled();
			expect(untold).not.toHaveBeenCalled();
		});

		it('gives back a claim whose publication the pub/sub refused, so the sweep retries it', async () => {
			const claim = { id: 'p1', at: new Date(), revision: 4, previousAt: null, previousRevision: 3 };
			const release = jest.fn(async () => true);
			const { service, pubSub } = signalsOver({
				report: jest.fn(async () => outcome()),
				claimPublication: jest.fn(async () => ({ kind: 'publish', outcome: outcome(), claim })),
				release
			});
			pubSub.publish.mockRejectedValueOnce(new Error('redis unavailable') as never);
			await expect(service.publishPresence({ status: RealtimePresenceStatus.ACTIVE })).resolves.toMatchObject({ status: 'active' });
			expect(release).toHaveBeenCalledWith(claim);
			// Delivered: nothing is given back.
			await service.publishPresence({ status: RealtimePresenceStatus.ACTIVE });
			expect(release).toHaveBeenCalledTimes(1);
		});

		it('gives back a claim won while the module stopped, so another process tells it', async () => {
			let answer: (value: unknown) => void = () => undefined;
			const claim = { id: 'p1', at: new Date(), revision: 4, previousAt: null, previousRevision: 3 };
			const claimPublication = jest.fn().mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
			const release = jest.fn(async () => true);
			const { service, pubSub } = signalsOver({ report: jest.fn(async () => outcome()), claimPublication, release });
			const reporting = service.publishPresence({ status: RealtimePresenceStatus.ACTIVE });
			await Promise.resolve();
			service.onModuleDestroy();
			answer({ kind: 'publish', outcome: outcome(), claim });
			await reporting;
			expect(release).toHaveBeenCalledWith(claim);
			expect(pubSub.publish).not.toHaveBeenCalled();
		});

		it('forgets the pending tries when the module stops', async () => {
			jest.useFakeTimers();
			const claimPublication = jest.fn(async () => ({ kind: 'later', at: Date.now() + 4_000 }));
			const { service } = signalsOver({ report: jest.fn(async () => outcome()), claimPublication });
			await service.publishPresence({ status: RealtimePresenceStatus.ACTIVE });
			service.onModuleDestroy();
			await jest.advanceTimersByTimeAsync(10_000);
			expect(claimPublication).toHaveBeenCalledTimes(1);
		});
	});

	it('sweeps on a timer while the module lives', () => {
		jest.useFakeTimers();
		try {
			const sweep = sweepOf([]);
			const { service } = signalsOver({ sweep });
			service.onModuleInit();
			jest.advanceTimersByTime(30_000);
			expect(sweep).toHaveBeenCalledTimes(1);
			service.onModuleDestroy();
			jest.advanceTimersByTime(60_000);
			expect(sweep).toHaveBeenCalledTimes(1);
		} finally {
			jest.useRealTimers();
		}
	});
});
