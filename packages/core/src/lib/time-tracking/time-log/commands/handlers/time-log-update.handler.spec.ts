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

	it('keeps the fields internal callers rely on (the timer stop sends isRunning / stoppedAt)', () => {
		expect(omitScopeFields({ isRunning: false, stoppedAt: 'x', id: 'y', tenant: {}, organization: {}, employee: {} })).toEqual({
			isRunning: false,
			stoppedAt: 'x'
		});
	});
});
