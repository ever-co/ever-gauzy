// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { BadRequestException } from '@nestjs/common';
import { IUser, TimeLogSourceEnum } from '@gauzy/contracts';
import { asTenantUser, createTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TimeLogCreateCommand } from '../time-log/commands';
import { TIME_LOG_TAG_NOT_FOUND } from '../time-log/time-log-tags';
import { TimerService } from './timer.service';

const MEETING = '00000000-0000-4000-8000-0000000000a1';
const THEIRS = '00000000-0000-4000-8000-0000000000b1';

/**
 * A timer start files its run under the tags it sends (ever-co/ever-gauzy#12029). Each one is a tag of the employee's
 * organization or of the whole tenant, checked before anything is stopped or written: a tag of another organization
 * refuses the start, and the run going on goes on.
 */
describe('TimerService.startTimer with tags', () => {
	const fixture = createTenantFixture({ user: { employeeId: 'employee-1' } as IUser });
	const employee = {
		id: 'employee-1',
		organizationId: fixture.organizationId,
		tenantId: fixture.tenantId,
		isTrackingEnabled: true
	};

	let restore: () => void;
	let service: TimerService;
	let execute: jest.Mock;
	let findTags: jest.Mock;
	let stopPreviousRunningTimers: jest.Mock;

	const createdInput = () => {
		const create = execute.mock.calls.find(([command]) => command instanceof TimeLogCreateCommand)?.[0];
		return (create as TimeLogCreateCommand | undefined)?.input;
	};

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		findTags = jest.fn(async () => [
			{ id: MEETING, organizationId: fixture.organizationId },
			{ id: THEIRS, organizationId: 'another-organization' }
		]);
		execute = jest.fn(async () => ({ id: 'log-new' }));
		const employeeService = { findOneByUserId: jest.fn(async () => employee), update: jest.fn() };
		const manager = { findOne: jest.fn(), getRepository: () => ({ find: findTags }) };
		service = new TimerService(
			{ manager } as never,
			undefined as never,
			undefined as never,
			undefined as never,
			employeeService as never,
			{ execute } as never,
			undefined as never
		);
		stopPreviousRunningTimers = jest.fn(async () => undefined);
		Object.assign(service, { stopPreviousRunningTimers });
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('files the run under the tags its start sends', async () => {
		await service.startTimer({ source: TimeLogSourceEnum.TEAMS, tags: [MEETING] });

		expect(findTags.mock.calls[0][0].where.tenantId).toBe(fixture.tenantId);
		expect(createdInput()?.tags).toEqual([{ id: MEETING }]);
	});

	it('refuses a tag of another organization before stopping or writing anything', async () => {
		const refusal = await service
			.startTimer({ source: TimeLogSourceEnum.TEAMS, tags: [MEETING, THEIRS] })
			.catch((error) => error);

		expect(refusal).toBeInstanceOf(BadRequestException);
		expect(refusal.getResponse()).toEqual(
			expect.objectContaining({ code: TIME_LOG_TAG_NOT_FOUND, tagIds: [THEIRS] })
		);
		expect(stopPreviousRunningTimers).not.toHaveBeenCalled();
		expect(createdInput()).toBeUndefined();
	});

	it('starts without reading any tag when the start sends none, as every client on develop does', async () => {
		await service.startTimer({ source: TimeLogSourceEnum.TEAMS });

		expect(findTags).not.toHaveBeenCalled();
		expect(createdInput()?.tags).toEqual([]);
	});
});
