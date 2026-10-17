import '../../../core/entities/internal';

import { IntegrationEntity } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { TimeSlotCreateCommand } from '../../../time-tracking/time-slot/commands';
import { IntegrationMapSyncEntityCommand } from '../integration-map.sync-entity.command';
import { IntegrationMapSyncTimeSlotCommand } from '../integration-map.sync-time-slot.command';
import { IntegrationMapSyncTimeSlotHandler } from './integration-map.sync-time-slot.handler';

/**
 * A Hubstaff slot that is not mapped yet gets a Gauzy time slot. It was created blank (every activity value 0),
 * and the time log saved right after skips a slot whose start already exists, so the slot's activity was lost.
 */
describe('IntegrationMapSyncTimeSlotHandler', () => {
	const hubstaffSlot = {
		id: 42,
		time_slot: '2026-10-12T10:10:00Z',
		starts_at: '2026-10-12T10:10:00Z',
		keyboard: 120,
		mouse: 300,
		overall: 420,
		tracked: 600,
		employeeId: 'employee-1'
	};
	const command = () =>
		new IntegrationMapSyncTimeSlotCommand({
			entity: hubstaffSlot as never,
			sourceId: '42',
			integrationId: 'integration-1',
			organizationId: 'org-1'
		});

	beforeEach(() => jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1'));
	afterEach(() => jest.restoreAllMocks());

	it("creates the missing time slot with the slot's activity, then maps it", async () => {
		const execute = jest.fn().mockResolvedValueOnce({ id: 'gauzy-slot-1' }).mockResolvedValueOnce({ id: 'map-1' });
		const integrationMapService = { findOneByWhereOptions: jest.fn().mockRejectedValue(new Error('not found')) };
		const handler = new IntegrationMapSyncTimeSlotHandler({ execute } as never, integrationMapService as never);

		expect(await handler.execute(command())).toEqual({ id: 'map-1' });

		const [[create], [map]] = execute.mock.calls;
		expect(create).toBeInstanceOf(TimeSlotCreateCommand);
		expect(create.input).toMatchObject({
			employeeId: 'employee-1',
			time_slot: hubstaffSlot.time_slot,
			keyboard: 120,
			mouse: 300,
			overall: 420,
			duration: 600,
			organizationId: 'org-1'
		});
		expect(map).toBeInstanceOf(IntegrationMapSyncEntityCommand);
		expect(map.input).toMatchObject({
			gauzyId: 'gauzy-slot-1',
			sourceId: '42',
			entity: IntegrationEntity.TIME_SLOT,
			integrationId: 'integration-1',
			organizationId: 'org-1'
		});
	});

	it('returns the existing mapping without creating anything', async () => {
		const execute = jest.fn();
		const integrationMapService = { findOneByWhereOptions: jest.fn().mockResolvedValue({ id: 'map-1' }) };
		const handler = new IntegrationMapSyncTimeSlotHandler({ execute } as never, integrationMapService as never);

		expect(await handler.execute(command())).toEqual({ id: 'map-1' });
		expect(execute).not.toHaveBeenCalled();
	});
});
