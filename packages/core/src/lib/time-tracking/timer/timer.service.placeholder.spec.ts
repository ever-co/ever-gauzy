// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { IUser } from '@gauzy/contracts';
import { asTenantUser, createTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TimeLogCreateCommand } from '../time-log/commands';
import { TimerService } from './timer.service';

/**
 * A member without an account (a placeholder, ever-co/ever-gauzy#11913) never runs a timer. Its account never signs
 * in, and the start refuses it on its own, even when someone turned its tracking on.
 */
describe('TimerService with a member without an account', () => {
	const fixture = createTenantFixture({ user: { employeeId: 'employee-placeholder' } as IUser });
	const placeholder = {
		id: 'employee-placeholder',
		organizationId: fixture.organizationId,
		tenantId: fixture.tenantId,
		isTrackingEnabled: true,
		isPlaceholder: true,
		organization: {}
	};

	let restore: () => void;
	let service: TimerService;
	let execute: jest.Mock;

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		execute = jest.fn(async () => ({ id: 'log-new' }));
		const employeeService = { findOneByUserId: jest.fn(async () => placeholder), update: jest.fn() };
		service = new TimerService(
			undefined as never,
			undefined as never,
			undefined as never,
			undefined as never,
			employeeService as never,
			{ execute } as never,
			undefined as never
		);
		Object.assign(service, {
			getLastRunningLog: jest.fn(async () => null),
			stopPreviousRunningTimers: jest.fn(async () => undefined),
			handleConflictingTimeLogs: jest.fn(async () => undefined)
		});
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('refuses to start a timer, with the reason, and creates no entry', async () => {
		const start = service.startTimer({});

		await expect(start).rejects.toThrow(ForbiddenException);
		await expect(start).rejects.toThrow('A member without an account does not run a timer.');
		const created = execute.mock.calls.some(([command]) => command instanceof TimeLogCreateCommand);
		expect(created).toBe(false);
	});
});
