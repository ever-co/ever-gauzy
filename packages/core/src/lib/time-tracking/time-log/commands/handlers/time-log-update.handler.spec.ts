// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { NotFoundException } from '@nestjs/common';
import { RequestContext } from '../../../../core/context';
import { TimeLogUpdateCommand } from '../time-log-update.command';
import { omitScopeFields, TimeLogUpdateHandler } from './time-log-update.handler';

/**
 * GHSA-6qvm-3wg4-26w4 — PUT /timesheet/time-log/:id.
 *
 * The handler spread its input straight into `update(timeLog.id, { ...input })`, and TenantBaseGuard
 * skips the body tenant check when a Tenant-Id header is present, so an employee could re-point their
 * own log at another tenant. Tenant and organization now come from the stored row.
 */

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

const LOGS = [
	{ id: 'log-own', tenantId: TENANT_A, organizationId: 'org-a', employeeId: 'employee-a' },
	{ id: 'log-foreign', tenantId: TENANT_B, organizationId: 'org-b', employeeId: 'employee-b' }
];

function createHandler() {
	const timeLogRepository = {
		findOneBy: jest.fn(
			async (where: any) =>
				LOGS.find((log) => Object.entries(where).every(([key, value]) => (log as any)[key] === value)) ?? null
		),
		update: jest.fn(async () => ({ affected: 1 }))
	};
	const timeSlotService = { generateTimeSlots: jest.fn(() => []) };
	const handler = new TimeLogUpdateHandler(
		{ execute: jest.fn() } as any,
		timeLogRepository as any,
		{} as any,
		{} as any,
		timeSlotService as any
	);
	return { handler, timeLogRepository };
}

describe('TimeLogUpdateHandler (GHSA-6qvm-3wg4-26w4)', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_A);
	});
	afterEach(() => jest.restoreAllMocks());

	const body = { description: 'edited', isBillable: true, tenantId: TENANT_B, organizationId: 'org-b' } as any;

	it('CONTROL: the pre-fix payload carries the body tenant and organization into the update', () => {
		expect({ ...body }).toMatchObject({ tenantId: TENANT_B, organizationId: 'org-b' });
	});

	it('updates within the stored tenant, without the body tenant / organization', async () => {
		const { handler, timeLogRepository } = createHandler();

		await handler.execute(new TimeLogUpdateCommand(body, 'log-own'));

		expect(timeLogRepository.update).toHaveBeenCalledWith(
			{ id: 'log-own', tenantId: TENANT_A },
			{ description: 'edited', isBillable: true }
		);
	});

	it('resolves an id inside the caller tenant only', async () => {
		const { handler, timeLogRepository } = createHandler();

		await expect(handler.execute(new TimeLogUpdateCommand(body, 'log-foreign'))).rejects.toThrow(NotFoundException);
		expect(timeLogRepository.findOneBy).toHaveBeenCalledWith({ id: 'log-foreign', tenantId: TENANT_A });
		expect(timeLogRepository.update).not.toHaveBeenCalled();
	});

	// A changed `employeeId` is a move (re-homed by the handler, see time-log.service.spec.ts); this pins the organization.
	it("runs its own slot cleanup in the stored log's organization, whatever organization the input names", async () => {
		const { handler } = createHandler();
		const timeSlotService = (handler as any).timeSlotService;
		const kept = new Date('2026-01-05T09:00:00.000Z');
		const dropped = new Date('2026-01-05T08:00:00.000Z');
		// The edited range keeps 09:00 and drops 08:00, so the 08:00 slot is the one the cleanup removes.
		timeSlotService.generateTimeSlots
			.mockReturnValueOnce([{ startedAt: kept }])
			.mockReturnValueOnce([{ startedAt: dropped }, { startedAt: kept }]);
		(handler as any).commandBus.execute.mockResolvedValue({ id: 'timesheet-1' });
		const removed = jest.spyOn(handler as any, 'releaseTimeSlots').mockResolvedValue(undefined);
		jest.spyOn(handler as any, 'saveUpdatedTimeLog').mockResolvedValue(undefined);
		jest.spyOn(handler as any, 'recalculateTimesheetAndEmployeeHours').mockResolvedValue(undefined);

		await handler.execute(
			new TimeLogUpdateCommand(
				{
					startedAt: kept,
					stoppedAt: new Date('2026-01-05T10:00:00.000Z'),
					organizationId: 'org-b'
				} as any,
				'log-own'
			)
		);

		expect(removed).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'log-own' }),
			TENANT_A,
			'org-a',
			'employee-a',
			[dropped],
			false
		);
	});

	it('keeps the fields internal callers rely on (the timer stop sends isRunning / stoppedAt)', () => {
		expect(omitScopeFields({ isRunning: false, stoppedAt: 'x', id: 'y', tenant: {}, organization: {}, employee: {} })).toEqual({
			isRunning: false,
			stoppedAt: 'x'
		});
	});
});
