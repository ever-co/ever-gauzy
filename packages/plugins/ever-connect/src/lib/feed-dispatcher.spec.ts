import { EverConnectScheduler } from './ever-connect-scheduler.service';
import { EverConnectSignals } from './ever-connect-signals';
import { CONSTANTS, EventEnvelope } from './sdk';

/**
 * The feed dispatcher: each catalog type has one follow-up (re-read the integration states, refresh
 * the documents, a link's or the connection's local steps); every other type is acknowledged and
 * ignored; an event read twice is handled once, and a page's follow-ups run once per page.
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
		const store = { linkById: jest.fn().mockResolvedValue({ linkId: 'L1', status: 'linked' }) };
		const signals = new EverConnectSignals();
		const revoked = jest.fn();
		signals.revoked$.subscribe(revoked);
		const instance = new EverConnectScheduler(
			{} as never,
			store as never,
			connection as never,
			states as never,
			links as never,
			entitlements as never,
			signals,
			{ feedMode: 'longpoll' } as never
		);
		return { instance, states, entitlements, links, connection, revoked };
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

	it('instance.revoked signals the revocation; nothing is scheduled before start', async () => {
		const { instance, revoked } = scheduler();
		expect(instance.active).toBe(false);
		await instance.dispatch(event('ever.registry.instance.revoked'));
		expect(revoked).toHaveBeenCalledTimes(1);
		expect(instance.active).toBe(false);
	});
});
