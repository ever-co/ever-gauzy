import { Logger } from '@nestjs/common';
import { EverConnectScheduler } from './ever-connect-scheduler.service';
import { EverConnectSignals } from './ever-connect-signals';
import { CONSTANTS, EventEnvelope, ProblemError } from './sdk';

/**
 * The feed dispatcher: each catalog type has one follow-up (re-read the integration states, refresh
 * the documents, a link's or the connection's local steps); every other type is acknowledged and
 * ignored; an event read twice is handled once, and a page's follow-ups run once per page. A
 * connection event of another installation, or of before this connection, is ignored; the cursor is
 * kept before it is acknowledged, and one that cannot be kept is never acknowledged.
 */
describe('Ever Platform feed dispatcher', () => {
	function scheduler(membership?: { apply: jest.Mock; resync?: jest.Mock }) {
		const states = { sync: jest.fn().mockResolvedValue(undefined) };
		const entitlements = {
			refreshAll: jest.fn().mockResolvedValue(undefined),
			importFromEnvFile: jest.fn().mockResolvedValue(undefined)
		};
		const links = {
			unlinkLocally: jest.fn().mockResolvedValue(undefined),
			linkStateChanged: jest.fn().mockResolvedValue(undefined)
		};
		const connection = {
			stopLocally: jest.fn().mockResolvedValue(undefined),
			approved: jest.fn().mockResolvedValue(undefined)
		};
		const order: string[] = [];
		const store = {
			linkById: jest.fn().mockResolvedValue({ linkId: 'L1', status: 'linked' }),
			connection: jest.fn().mockResolvedValue({
				status: 'connected',
				platformInstanceId: '01JD00000000000000000INST01',
				connectedAt: Date.parse('2026-10-03T09:00:00.000Z'),
				feedCursor: null
			}),
			takeLease: jest.fn().mockResolvedValue(true),
			releaseLease: jest.fn().mockResolvedValue(undefined),
			holdsLease: jest.fn().mockResolvedValue(true),
			updateConnection: jest.fn(async (values: Record<string, unknown>) => {
				if ('feedCursor' in values) order.push(`keep ${values['feedCursor']}`);
				return 1;
			})
		};
		const client = {
			instances: {
				events: jest.fn(),
				ackEvents: jest.fn(async (id: string) => {
					order.push(`ack ${id}`);
				})
			}
		};
		const platform = { getClient: jest.fn().mockResolvedValue(client) };
		const cleanup = { reconcile: jest.fn().mockResolvedValue(0) };
		const signals = new EverConnectSignals();
		const revoked = jest.fn();
		signals.revoked$.subscribe(revoked);
		const instance = new EverConnectScheduler(
			platform as never,
			store as never,
			connection as never,
			states as never,
			links as never,
			entitlements as never,
			cleanup as never,
			signals,
			{ feedMode: 'interval' } as never,
			undefined,
			undefined,
			undefined,
			undefined,
			membership as never
		);
		return { instance, states, entitlements, links, connection, revoked, client, order, cleanup, store };
	}

	const event = (
		type: string,
		id = `01JD${type.length.toString().padStart(22, '0')}`,
		data: Record<string, unknown> = {}
	): EventEnvelope =>
		({
			id,
			type,
			version: 1,
			occurred_at: '2026-10-03T10:00:00.000Z',
			subject: { type: 'x', id: 'L1' },
			data
		}) as never;

	it.each([
		['ever.consent.consent.granted', 'states'],
		['ever.consent.consent.revoked', 'states'],
		['ever.consent.integration.enabled', 'states'],
		['ever.consent.integration.disabled', 'states'],
		['ever.consent.integration.scope_bumped', 'states'],
		['ever.entitlements.entitlement.issued', 'entitlements'],
		['ever.entitlements.entitlement.revoked', 'entitlements'],
		['ever.registry.tenant_link.unlinked', 'link'],
		['ever.registry.tenant_link.suspended', 'link'],
		['ever.registry.tenant_link.orphaned', 'link'],
		['ever.registry.tenant_link.resumed', 'link'],
		['ever.registry.instance.revoked', 'connection'],
		['ever.registry.instance.disconnected', 'connection'],
		['ever.registry.instance.approved', 'connection']
	])('%s → %s', async (type, outcome) => {
		const { instance } = scheduler();
		expect(await instance.dispatch(event(type))).toBe(outcome);
	});

	it('every other catalog type is acknowledged and ignored', async () => {
		const handled = new Set([
			'ever.consent.consent.granted',
			'ever.consent.consent.revoked',
			'ever.consent.integration.enabled',
			'ever.consent.integration.disabled',
			'ever.consent.integration.scope_bumped',
			'ever.entitlements.entitlement.issued',
			'ever.entitlements.entitlement.revoked',
			'ever.registry.tenant_link.unlinked',
			'ever.registry.tenant_link.suspended',
			'ever.registry.tenant_link.orphaned',
			'ever.registry.tenant_link.resumed',
			'ever.registry.instance.revoked',
			'ever.registry.instance.disconnected',
			'ever.registry.instance.approved'
		]);
		const { instance, states, entitlements, links, connection, revoked } = scheduler();
		for (const type of CONSTANTS.feed_event_types.filter((t: string) => !handled.has(t))) {
			expect(await instance.dispatch(event(type))).toBe('ignored');
		}
		expect(await instance.dispatch(event('ever.something.new.v2'))).toBe('ignored');
		for (const spy of [
			states.sync,
			entitlements.refreshAll,
			links.unlinkLocally,
			connection.stopLocally,
			connection.approved,
			revoked
		]) {
			expect(spy).not.toHaveBeenCalled();
		}
	});

	describe('membership changes', () => {
		const TYPES = [
			'ever.registry.membership.created',
			'ever.registry.membership.role_changed',
			'ever.registry.membership.removed'
		];

		it('without the membership sync (the default): acknowledged and ignored, nothing else runs', async () => {
			const { instance, states, entitlements, links, connection } = scheduler();
			for (const type of TYPES) {
				expect(await instance.dispatch(event(type, undefined, { tenant_link_id: 'L1' }))).toBe('ignored');
			}
			for (const spy of [states.sync, entitlements.refreshAll, links.unlinkLocally, connection.stopLocally]) {
				expect(spy).not.toHaveBeenCalled();
			}
		});

		it('with it: each one goes to the membership handler', async () => {
			const membership = { apply: jest.fn().mockResolvedValue('role_granted') };
			const { instance } = scheduler(membership);
			for (const type of TYPES) {
				expect(await instance.dispatch(event(type))).toBe('membership');
			}
			expect(membership.apply).toHaveBeenCalledTimes(3);
			// Not a membership change: never handed to it.
			expect(await instance.dispatch(event('ever.registry.membership.listing_changed'))).toBe('ignored');
			expect(membership.apply).toHaveBeenCalledTimes(3);
		});

		it('of another installation, or of before this connection: ignored', async () => {
			const membership = { apply: jest.fn().mockResolvedValue('role_granted') };
			const { instance } = scheduler(membership);
			const ours = {
				platformInstanceId: '01JD00000000000000000INST01',
				connectedAt: Date.parse('2026-10-03T09:00:00.000Z')
			};
			const other = { ...event(TYPES[0]), instance_id: '01JD00000000000000000OTHER1' } as never;
			const old = { ...event(TYPES[1]), occurred_at: '2026-10-01T09:00:00.000Z' } as never;
			expect(await instance.dispatch(other, ours)).toBe('ignored');
			expect(await instance.dispatch(old, ours)).toBe('ignored');
			expect(membership.apply).not.toHaveBeenCalled();
			const mine = { ...event(TYPES[2]), instance_id: ours.platformInstanceId } as never;
			expect(await instance.dispatch(mine, ours)).toBe('membership');
			expect(membership.apply).toHaveBeenCalledTimes(1);
		});

		it('a failure of the handler fails the page, so the feed reads it again', async () => {
			const membership = { apply: jest.fn().mockRejectedValue(new Error('database unavailable')) };
			const { instance } = scheduler(membership);
			const page = [event(TYPES[0], '01JD0000000000000000000071')];
			await expect(instance.dispatchPage(page)).rejects.toThrow('database unavailable');
			// Not remembered as handled: the same event is handed over again.
			membership.apply.mockResolvedValueOnce('role_granted');
			expect(await instance.dispatchPage(page)).toEqual(['membership']);
		});

		it('with the membership sync on, a membership resync runs once after a start, before the feed is read', async () => {
			const membership = { apply: jest.fn(), resync: jest.fn().mockResolvedValue('done') };
			const { instance, client, store } = scheduler(membership);
			client.instances.events.mockResolvedValue({ events: [], last_id: '', has_more: false });

			await instance.readFeed();
			expect(membership.resync).toHaveBeenCalledTimes(1);
			expect(membership.resync.mock.calls[0][0]).toBe(client);
			expect(membership.resync.mock.invocationCallOrder[0]).toBeLessThan(
				client.instances.events.mock.invocationCallOrder[0]
			);
			// The lease is renewed through the scheduler's own holder.
			store.takeLease.mockClear();
			expect(await membership.resync.mock.calls[0][1]()).toBe(true);
			expect(store.takeLease).toHaveBeenCalledTimes(1);
			// A renewal that fails (the database) is a lost lease, never a reason to go on.
			store.takeLease.mockRejectedValueOnce(new Error('database unavailable'));
			expect(await membership.resync.mock.calls[0][1]()).toBe(false);

			await instance.readFeed();
			expect(membership.resync).toHaveBeenCalledTimes(1);

			// Started again (connected again): owed again.
			instance.start();
			instance.stop();
			await instance.readFeed();
			expect(membership.resync).toHaveBeenCalledTimes(2);
		});

		it('after a 410, the membership resync runs before the position moves on', async () => {
			const membership = { apply: jest.fn(), resync: jest.fn().mockResolvedValue('done') };
			const { instance, client, order } = scheduler(membership);
			client.instances.events.mockResolvedValue({ events: [], last_id: '', has_more: false });
			await instance.readFeed();
			membership.resync.mockImplementationOnce(async () => {
				order.push('resync');
				return 'done';
			});
			client.instances.events.mockRejectedValueOnce(
				new ProblemError(410, 'resync_required', undefined, null, undefined, undefined, '01JD0000000000000000000042')
			);

			expect(await instance.readFeed()).toBe(true);
			expect(order).toEqual(['resync', 'keep 01JD0000000000000000000042', 'ack 01JD0000000000000000000042']);
			// A failed resync does not hold the feed back.
			order.length = 0;
			membership.resync.mockResolvedValueOnce('failed');
			client.instances.events.mockRejectedValueOnce(
				new ProblemError(410, 'resync_required', undefined, null, undefined, undefined, '01JD0000000000000000000043')
			);
			expect(await instance.readFeed()).toBe(true);
			expect(order).toEqual(['keep 01JD0000000000000000000043', 'ack 01JD0000000000000000000043']);
		});

		it('a lease check that answered false wins over a later failure (a transaction that did not commit)', async () => {
			const membership = { apply: jest.fn(), resync: jest.fn().mockResolvedValue('done') };
			const { instance, client, order, store } = scheduler(membership);
			client.instances.events.mockResolvedValue({ events: [], last_id: '', has_more: false });
			await instance.readFeed();
			store.holdsLease.mockResolvedValueOnce(false);
			membership.resync.mockImplementationOnce(
				async (_client: unknown, _keep: unknown, check: (tx: unknown) => Promise<boolean>) => {
					expect(await check({})).toBe(false);
					throw new Error('commit failed');
				}
			);
			client.instances.events.mockRejectedValueOnce(
				new ProblemError(410, 'resync_required', undefined, null, undefined, undefined, '01JD0000000000000000000042')
			);

			expect(await instance.readFeed()).toBe(false);
			expect(order).toEqual([]);
		});

		it('the 410 position moves on only while the lease is still held: lost during a page that then failed, it stays', async () => {
			const membership = { apply: jest.fn(), resync: jest.fn().mockResolvedValue('done') };
			const { instance, client, order, store } = scheduler(membership);
			client.instances.events.mockResolvedValue({ events: [], last_id: '', has_more: false });
			await instance.readFeed();
			membership.resync.mockImplementationOnce(async () => {
				// Another process takes the lease while a page request is in flight; the request then fails.
				store.takeLease.mockResolvedValueOnce(false);
				return 'failed';
			});
			client.instances.events.mockRejectedValueOnce(
				new ProblemError(410, 'resync_required', undefined, null, undefined, undefined, '01JD0000000000000000000042')
			);

			expect(await instance.readFeed()).toBe(false);
			expect(order).toEqual([]);
		});

		it('the 410 position is kept in one compare-and-set on the lease holder: taken over just before, it stays', async () => {
			const membership = { apply: jest.fn(), resync: jest.fn().mockResolvedValue('done') };
			const { instance, client, order, store } = scheduler(membership);
			client.instances.events.mockResolvedValue({ events: [], last_id: '', has_more: false });
			await instance.readFeed();
			// The renewal succeeds; another process takes the lease before the position is kept.
			store.updateConnection.mockImplementationOnce(async (_values: Record<string, unknown>) => 0);
			client.instances.events.mockRejectedValueOnce(
				new ProblemError(410, 'resync_required', undefined, null, undefined, undefined, '01JD0000000000000000000042')
			);

			expect(await instance.readFeed()).toBe(false);
			expect(store.updateConnection).toHaveBeenLastCalledWith(
				{ feedCursor: '01JD0000000000000000000042' },
				{ leasedBy: expect.any(String) }
			);
			expect(client.instances.ackEvents).not.toHaveBeenCalled();
			expect(order).toEqual([]);
		});

		it('a run stopped while its read was starting goes no further and gives back a lease taken after the stop', async () => {
			const membership = { apply: jest.fn(), resync: jest.fn().mockResolvedValue('done') };
			const { instance, client, store } = scheduler(membership);
			store.takeLease.mockImplementationOnce(async () => {
				instance.stop();
				return true;
			});
			store.releaseLease.mockClear();

			expect(await instance.readFeed()).toBe(false);
			expect(membership.resync).not.toHaveBeenCalled();
			expect(client.instances.events).not.toHaveBeenCalled();
			// Once by stop(), once for the lease taken after it.
			expect(store.releaseLease).toHaveBeenCalledTimes(2);
		});

		it('a resync that lost the lease leaves the position, so the next lease holder is answered 410 again', async () => {
			const membership = { apply: jest.fn(), resync: jest.fn().mockResolvedValue('done') };
			const { instance, client, order } = scheduler(membership);
			client.instances.events.mockResolvedValue({ events: [], last_id: '', has_more: false });
			await instance.readFeed();
			membership.resync.mockResolvedValueOnce('lease_lost');
			client.instances.events.mockRejectedValueOnce(
				new ProblemError(410, 'resync_required', undefined, null, undefined, undefined, '01JD0000000000000000000042')
			);

			expect(await instance.readFeed()).toBe(false);
			expect(order).toEqual([]);
		});

		it('after the startup resync the lease is renewed: lost during a page that then failed, the feed is not read', async () => {
			const membership = { apply: jest.fn(), resync: jest.fn() };
			const { instance, client, store } = scheduler(membership);
			membership.resync.mockImplementationOnce(async () => {
				store.takeLease.mockResolvedValueOnce(false);
				return 'failed';
			});

			expect(await instance.readFeed()).toBe(false);
			expect(client.instances.events).not.toHaveBeenCalled();
			// Still owed: it runs when this process holds the lease again.
			membership.resync.mockResolvedValueOnce('done');
			client.instances.events.mockResolvedValue({ events: [], last_id: '', has_more: false });
			await instance.readFeed();
			expect(membership.resync).toHaveBeenCalledTimes(2);
		});

		it('the startup resync: one that lost the lease stays owed; one that failed waits for the next 410 or start', async () => {
			const membership = { apply: jest.fn(), resync: jest.fn().mockResolvedValueOnce('lease_lost') };
			const { instance, client } = scheduler(membership);
			client.instances.events.mockResolvedValue({ events: [], last_id: '', has_more: false });

			expect(await instance.readFeed()).toBe(false);
			expect(client.instances.events).not.toHaveBeenCalled();
			membership.resync.mockRejectedValueOnce(new Error('database unavailable'));
			await instance.readFeed();
			expect(membership.resync).toHaveBeenCalledTimes(2);
			expect(client.instances.events).toHaveBeenCalledTimes(1);
			await instance.readFeed();
			expect(membership.resync).toHaveBeenCalledTimes(2);
		});

		it('a resync of a run that was stopped meanwhile writes nothing more: its lease renewal answers false', async () => {
			const membership = {
				apply: jest.fn(),
				resync: jest.fn(async (_client: unknown, keep: () => Promise<boolean>) => {
					instance.stop();
					return (await keep()) ? 'done' : 'lease_lost';
				})
			};
			const { instance, client, store } = scheduler(membership as never);
			store.takeLease.mockClear();

			expect(await instance.readFeed()).toBe(false);
			expect(store.takeLease).toHaveBeenCalledTimes(1);
			expect(client.instances.events).not.toHaveBeenCalled();
		});

		it('a run stopped while its resync ran (no list left to check) neither reads the feed nor moves the position', async () => {
			const membership = { apply: jest.fn(), resync: jest.fn() };
			const { instance, client, order } = scheduler(membership as never);
			membership.resync.mockImplementationOnce(async () => {
				instance.stop();
				return 'done';
			});

			expect(await instance.readFeed()).toBe(false);
			expect(client.instances.events).not.toHaveBeenCalled();

			// The same for a 410 of a run stopped while its resync ran.
			membership.resync.mockResolvedValueOnce('done');
			client.instances.events.mockResolvedValue({ events: [], last_id: '', has_more: false });
			await instance.readFeed();
			membership.resync.mockImplementationOnce(async () => {
				instance.stop();
				return 'done';
			});
			client.instances.events.mockRejectedValueOnce(
				new ProblemError(410, 'resync_required', undefined, null, undefined, undefined, '01JD0000000000000000000042')
			);
			expect(await instance.readFeed()).toBe(false);
			expect(order).toEqual([]);
		});

		it('a renewal in flight when the run stops answers false and gives the lease back', async () => {
			const membership = {
				apply: jest.fn(),
				resync: jest.fn(async (_client: unknown, keep: () => Promise<boolean>) =>
					(await keep()) ? 'done' : 'lease_lost'
				)
			};
			const { instance, client, store } = scheduler(membership as never);
			store.takeLease.mockResolvedValueOnce(true).mockImplementationOnce(async () => {
				instance.stop();
				return true;
			});
			store.releaseLease.mockClear();

			expect(await instance.readFeed()).toBe(false);
			expect(client.instances.events).not.toHaveBeenCalled();
			// Once by stop(), once for the renewal that came back after it.
			expect(store.releaseLease).toHaveBeenCalledTimes(2);
		});

		it('with the membership sync off, no resync runs and nothing is said', async () => {
			const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
			try {
				const client = { call: jest.fn(), instances: { ackEvents: jest.fn().mockResolvedValue(undefined) } };
				expect(await scheduler().instance.resync(client, '01JD0000000000000000000042')).toBe(true);
				expect(warn).not.toHaveBeenCalled();
				expect(client.call).not.toHaveBeenCalled();
			} finally {
				warn.mockRestore();
			}
		});

		it('a failed follow-up: the other one still runs, the first error is thrown, its events are handed over again', async () => {
			const membership = { apply: jest.fn().mockRejectedValueOnce(new Error('database unavailable')) };
			const { instance, states, entitlements } = scheduler(membership);
			states.sync.mockRejectedValueOnce(new Error('states unavailable'));
			const page = [
				event('ever.consent.integration.enabled', '01JD0000000000000000000091'),
				event('ever.entitlements.entitlement.issued', '01JD0000000000000000000092'),
				event(TYPES[0], '01JD0000000000000000000093')
			];
			await expect(instance.dispatchPage(page)).rejects.toThrow('database unavailable');
			expect(states.sync).toHaveBeenCalledTimes(1);
			expect(entitlements.refreshAll).toHaveBeenCalledTimes(1);
			// Read again: the consent event (its follow-up failed) and the membership change are handed over again.
			membership.apply.mockResolvedValueOnce('role_granted');
			expect(await instance.dispatchPage(page)).toEqual(['states', 'ignored', 'membership']);
			expect(states.sync).toHaveBeenCalledTimes(2);
			expect(entitlements.refreshAll).toHaveBeenCalledTimes(1);
		});

		it('a failure after other events of the page: their follow-ups still run, once', async () => {
			const membership = { apply: jest.fn().mockRejectedValueOnce(new Error('database unavailable')) };
			const { instance, states, entitlements } = scheduler(membership);
			const page = [
				event('ever.consent.integration.enabled', '01JD0000000000000000000081'),
				event('ever.entitlements.entitlement.issued', '01JD0000000000000000000082'),
				event(TYPES[0], '01JD0000000000000000000083')
			];
			await expect(instance.dispatchPage(page)).rejects.toThrow('database unavailable');
			expect(states.sync).toHaveBeenCalledTimes(1);
			expect(entitlements.refreshAll).toHaveBeenCalledTimes(1);
			// Read again: the handled events are skipped, the failed one is applied, nothing runs twice.
			membership.apply.mockResolvedValueOnce('role_granted');
			expect(await instance.dispatchPage(page)).toEqual(['ignored', 'ignored', 'membership']);
			expect(states.sync).toHaveBeenCalledTimes(1);
			expect(entitlements.refreshAll).toHaveBeenCalledTimes(1);
		});
	});

	it('a page: follow-ups once per page, an event read twice handled once', async () => {
		const { instance, states, entitlements, links } = scheduler();
		const page = [
			event('ever.consent.consent.granted', '01JD0000000000000000000001'),
			event('ever.consent.integration.enabled', '01JD0000000000000000000002'),
			event('ever.entitlements.entitlement.issued', '01JD0000000000000000000003'),
			event('ever.registry.tenant_link.unlinked', '01JD0000000000000000000004', { tenant_link_id: 'L1' })
		];
		await instance.dispatchPage(page);
		expect(states.sync).toHaveBeenCalledTimes(1);
		expect(entitlements.refreshAll).toHaveBeenCalledTimes(1);
		expect(links.unlinkLocally).toHaveBeenCalledTimes(1);
		// The same page again (a crash before the acknowledgement): nothing more happens.
		expect(await instance.dispatchPage(page)).toEqual(['ignored', 'ignored', 'ignored', 'ignored']);
		expect(states.sync).toHaveBeenCalledTimes(1);
		expect(links.unlinkLocally).toHaveBeenCalledTimes(1);
	});

	it('connection events of another installation, or of before this connection, are ignored', async () => {
		const { instance, connection, revoked } = scheduler();
		const ours = { platformInstanceId: '01JD00000000000000000INST01', connectedAt: Date.parse('2026-10-03T09:00:00.000Z') };
		const other = { ...event('ever.registry.instance.disconnected'), instance_id: '01JD00000000000000000OTHER1' } as never;
		expect(await instance.dispatch(other, ours)).toBe('ignored');
		const old = { ...event('ever.registry.instance.revoked'), occurred_at: '2026-10-01T09:00:00.000Z' } as never;
		expect(await instance.dispatch(old, ours)).toBe('ignored');
		expect(connection.stopLocally).not.toHaveBeenCalled();
		expect(revoked).not.toHaveBeenCalled();
		// Control: the same events for this connection, after it was made, are handled.
		const mine = { ...event('ever.registry.instance.disconnected'), instance_id: ours.platformInstanceId } as never;
		expect(await instance.dispatch(mine, ours)).toBe('connection');
		expect(connection.stopLocally).toHaveBeenCalledTimes(1);
	});

	it('the cursor is kept, then acknowledged; a cursor that cannot be kept is never acknowledged', async () => {
		const { instance, client, order, cleanup } = scheduler();
		client.instances.events.mockResolvedValueOnce({ events: [], last_id: '01JD0000000000000000000009', has_more: false });
		await instance.readFeed();
		expect(order).toEqual(['keep 01JD0000000000000000000009', 'ack 01JD0000000000000000000009']);
		expect(cleanup.reconcile).toHaveBeenCalled();
		order.length = 0;
		client.instances.events.mockResolvedValueOnce({ events: [], last_id: 'X'.repeat(65), has_more: true });
		expect(await instance.readFeed()).toBe(false);
		expect(order).toEqual([]);
		expect(client.instances.ackEvents).toHaveBeenCalledTimes(1);
	});

	it('410 resync_required: the states and documents are read again, then the named position is kept and acknowledged', async () => {
		const { instance, client, order, states, entitlements } = scheduler();
		client.instances.events.mockRejectedValueOnce(
			new ProblemError(410, 'resync_required', undefined, null, undefined, undefined, '01JD0000000000000000000042')
		);
		expect(await instance.readFeed()).toBe(true);
		expect(states.sync).toHaveBeenCalledWith({ force: true });
		expect(entitlements.refreshAll).toHaveBeenCalledTimes(1);
		expect(order).toEqual(['keep 01JD0000000000000000000042', 'ack 01JD0000000000000000000042']);
		// Without a position: read again from the start.
		order.length = 0;
		client.instances.events.mockRejectedValueOnce(new ProblemError(410, 'resync_required'));
		await instance.readFeed();
		expect(order).toEqual(['keep null']);
	});

	it('instance.revoked signals the revocation; nothing is scheduled before start', async () => {
		const { instance, revoked } = scheduler();
		expect(instance.active).toBe(false);
		await instance.dispatch(event('ever.registry.instance.revoked'));
		expect(revoked).toHaveBeenCalledTimes(1);
		expect(instance.active).toBe(false);
	});
});
