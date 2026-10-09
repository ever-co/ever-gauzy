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
	function scheduler() {
		const states = { sync: jest.fn().mockResolvedValue(undefined) };
		const entitlements = { refreshAll: jest.fn().mockResolvedValue(undefined) };
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
			updateConnection: jest.fn(async (values: Record<string, unknown>) => {
				if ('feedCursor' in values) order.push(`keep ${values['feedCursor']}`);
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
			{ feedMode: 'interval' } as never
		);
		return { instance, states, entitlements, links, connection, revoked, client, order, cleanup };
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
