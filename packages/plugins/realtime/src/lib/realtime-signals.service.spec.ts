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

function signalsOver(store: Partial<Record<'report' | 'sweep', jest.Mock>>) {
	const pubSub = { publish: jest.fn(async () => undefined) };
	const service = new RealtimeSignalsService({} as DataSource, store as unknown as RealtimePresenceStore, pubSub as unknown as GraphqlPubSub);
	return { service, pubSub };
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
			expect.objectContaining({ name: 'presence.changed', tenantId: 'ten', organizationId: 'org', aggregate: { type: 'employee', id: 'e1' }, data: presence })
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
			expect.objectContaining({ organizationId: 'org-2', data: expect.objectContaining({ employeeId: 'e2', status: 'offline', at: now.toISOString() }) })
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
