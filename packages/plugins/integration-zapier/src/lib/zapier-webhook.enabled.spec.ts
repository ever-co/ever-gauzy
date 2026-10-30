/**
 * `PUT /integration/zapier/settings` stores whether an integration is enabled (`is_enabled`), and the settings form
 * calls it "Enable integration". Delivery read nothing of it: a switched-off integration's REST hooks kept receiving
 * every employee's timer events. They are skipped now, per integration: a subscription of another, enabled integration
 * of the organization still gets the event, and a flag never stored (integrations are created enabled) counts as on.
 */
// `@gauzy/core`'s barrel drags in the whole entity graph (pre-existing circular import). Every name it
// gives these files is replaced by a stand-in usable as a class, a decorator factory or a helper.
jest.mock('@gauzy/core', () => {
	function stub(this: unknown) {
		// Called as a decorator factory: hand back a no-op decorator
		return new.target ? undefined : () => undefined;
	}
	return new Proxy({ DEFAULT_ENTITY_SETTINGS: [], PROJECT_TIED_ENTITIES: [] } as Record<string, unknown>, {
		get: (target, name: string) => (name in target ? target[name] : name === '__esModule' ? true : stub)
	});
});

import { of } from 'rxjs';
import { ZapierWebhookService } from './zapier-webhook.service';

const subscription = (id: string, integrationId?: string) => ({
	id,
	targetUrl: `https://hooks.example.com/catch/${id}`,
	event: 'timer.status.changed',
	tenantId: 'tenant-1',
	organizationId: 'organization-1',
	...(integrationId ? { integrationId } : {})
});

const timerEvent = (timeLogId: string) => ({
	event: 'timer.status.changed',
	action: 'start' as const,
	tenantId: 'tenant-1',
	organizationId: 'organization-1',
	data: { id: timeLogId } as any
});

describe('Zapier webhook delivery honours the integration’s is_enabled flag', () => {
	const build = (subscriptions: unknown[], disabledIntegrationIds: string[]) => {
		const query: Record<string, jest.Mock> = {
			select: jest.fn(),
			from: jest.fn(),
			where: jest.fn(),
			andWhere: jest.fn(),
			getRawMany: jest.fn().mockResolvedValue(disabledIntegrationIds.map((integrationId) => ({ integrationId })))
		};
		['select', 'from', 'where', 'andWhere'].forEach((step) => query[step].mockReturnValue(query));
		const repository = {
			find: jest.fn().mockResolvedValue(subscriptions),
			manager: { createQueryBuilder: jest.fn(() => query) }
		};
		const post = jest.fn().mockReturnValue(of({ data: {}, status: 200 }));
		const service = new ZapierWebhookService(repository as any, { post } as any);
		jest.spyOn((service as any).logger, 'debug').mockImplementation(() => undefined);
		const delivered = () => post.mock.calls.map(([url]: [string]) => url);
		return { service, query, repository, delivered };
	};

	it('skips the subscriptions of a switched-off integration, and only those', async () => {
		const { service, query, delivered } = build(
			[
				subscription('a', 'integration-off'),
				subscription('b', 'integration-on'),
				subscription('c', 'integration-off')
			],
			['integration-off']
		);

		await service.notifyTimerStatusChanged(timerEvent('time-log-1'));

		expect(delivered()).toEqual(['https://hooks.example.com/catch/b']);
		expect(query['from']).toHaveBeenCalledWith('integration_setting', 'setting');
		expect(query['where']).toHaveBeenCalledWith('setting.tenantId = :tenantId', { tenantId: 'tenant-1' });
		expect(query['andWhere']).toHaveBeenCalledWith('setting.integrationId IN (:...ids)', {
			ids: ['integration-off', 'integration-on']
		});
		expect(query['andWhere']).toHaveBeenCalledWith('setting.settingsName = :settingsName', {
			settingsName: 'is_enabled'
		});
		expect(query['andWhere']).toHaveBeenCalledWith('setting.settingsValue = :settingsValue', {
			settingsValue: 'false'
		});
	});

	it('delivers to every subscription when no integration is switched off', async () => {
		const { service, delivered } = build(
			[subscription('a', 'integration-1'), subscription('b', 'integration-2')],
			[]
		);

		await service.notifyTimerStatusChanged(timerEvent('time-log-2'));

		expect(delivered()).toEqual(['https://hooks.example.com/catch/a', 'https://hooks.example.com/catch/b']);
	});

	it('delivers to a subscription stored without an integration, without asking for any flag', async () => {
		const { service, repository, delivered } = build([subscription('legacy')], []);

		await service.notifyTimerStatusChanged(timerEvent('time-log-3'));

		expect(delivered()).toEqual(['https://hooks.example.com/catch/legacy']);
		expect(repository.manager.createQueryBuilder).not.toHaveBeenCalled();
	});
});
