jest.mock('../../employee/employee.module', () => ({ EmployeeModule: class EmployeeModule {} }));
jest.mock('../../organization-project/organization-project.module', () => ({
	OrganizationProjectModule: class OrganizationProjectModule {}
}));
jest.mock('../../role-permission/role-permission.module', () => ({
	RolePermissionModule: class RolePermissionModule {}
}));
jest.mock('../../shared/guards', () => ({ TenantPermissionGuard: class TenantPermissionGuard {} }));
jest.mock('../../tasks/task.module', () => ({ TaskModule: class TaskModule {} }));
jest.mock('../../user/user.module', () => ({ UserModule: class UserModule {} }));
jest.mock('../activity/activity.module', () => ({ ActivityModule: class ActivityModule {} }));
jest.mock('../time-log/time-log.module', () => ({ TimeLogModule: class TimeLogModule {} }));
jest.mock('../time-slot/time-slot.module', () => ({ TimeSlotModule: class TimeSlotModule {} }));
jest.mock('./statistic.controller', () => ({ StatisticController: class StatisticController {} }));
jest.mock('./statistic.service', () => ({ StatisticService: class StatisticService {} }));

import 'reflect-metadata';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import {
	GUARDS_METADATA,
	METHOD_METADATA,
	MODULE_METADATA,
	PARAMTYPES_METADATA,
	PATH_METADATA,
	PIPES_METADATA,
	ROUTE_ARGS_METADATA
} from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { IProfileActivity } from '@gauzy/contracts';
import { EmployeeModule } from '../../employee/employee.module';
import { OrganizationProjectModule } from '../../organization-project/organization-project.module';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TenantPermissionGuard } from '../../shared/guards';
import { TaskModule } from '../../tasks/task.module';
import { UserModule } from '../../user/user.module';
import { ActivityModule } from '../activity/activity.module';
import { TimeLogModule } from '../time-log/time-log.module';
import { TimeSlotModule } from '../time-slot/time-slot.module';
import { ProfileActivityQueryDTO } from './dto/profile-activity-query.dto';
import { ProfileActivityController } from './profile-activity.controller';
import { StatisticController } from './statistic.controller';
import { StatisticModule } from './statistic.module';
import { StatisticService } from './statistic.service';

type ProfileActivityValidationPipe = ValidationPipe & {
	isTransformEnabled: boolean;
	validatorOptions: { whitelist?: boolean };
};

const API_TAGS_METADATA = 'swagger/apiUseTags';

const query = {
	organizationId: '18b92310-bb29-4ae0-b78a-a1e6493b688c',
	employeeId: '4bfb00a0-5ec3-4736-bc6d-0d5bb83e114c',
	organizationTeamId: '94ac71ab-4505-4ead-a357-a12c03d88973',
	startDate: '2026-08-01',
	endDate: '2026-09-01',
	timeZone: 'Europe/Madrid',
	includeDaily: true
} as ProfileActivityQueryDTO;

const response: IProfileActivity = {
	employeeId: query.employeeId,
	activeDays: 2,
	totalDuration: 900.3,
	firstActiveOn: '2026-08-03',
	lastActiveOn: '2026-08-19',
	period: {
		startDate: query.startDate,
		endDate: query.endDate,
		timeZone: query.timeZone
	},
	daily: [
		{ date: '2026-08-03', duration: 300.1 },
		{ date: '2026-08-19', duration: 600.2 }
	]
};

function createController(getProfileActivity: StatisticService['getProfileActivity']): ProfileActivityController {
	return new ProfileActivityController({ getProfileActivity } as StatisticService);
}

describe('ProfileActivityController', () => {
	it('registers the exact guarded GET query endpoint and validation boundary', () => {
		const handler = ProfileActivityController.prototype.getProfileActivity;

		expect(Reflect.getMetadata(API_TAGS_METADATA, ProfileActivityController)).toEqual(['TimesheetStatistic']);
		expect(Reflect.getMetadata(PATH_METADATA, ProfileActivityController)).toBe('/timesheet/statistics');
		expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('/profile-activity');
		expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET);
		expect(Reflect.getMetadata(GUARDS_METADATA, ProfileActivityController)).toEqual([TenantPermissionGuard]);
		expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ProfileActivityController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, handler)).toBeUndefined();

		expect(
			Reflect.getMetadata(PARAMTYPES_METADATA, ProfileActivityController.prototype, 'getProfileActivity')
		).toEqual([ProfileActivityQueryDTO]);
		expect(Reflect.getMetadata(ROUTE_ARGS_METADATA, ProfileActivityController, 'getProfileActivity')).toEqual({
			[`${RouteParamtypes.QUERY}:0`]: { index: 0, data: undefined, pipes: [] }
		});

		const pipes = Reflect.getMetadata(PIPES_METADATA, handler) as ProfileActivityValidationPipe[];
		expect(pipes).toHaveLength(1);
		expect(pipes[0]).toBeInstanceOf(ValidationPipe);
		expect(pipes[0].isTransformEnabled).toBe(true);
		expect(pipes[0].validatorOptions.whitelist).toBe(true);
	});

	it('returns the exact service promise and result for the exact transformed DTO object', async () => {
		const servicePromise = Promise.resolve(response);
		const getProfileActivity = jest.fn(() => servicePromise);
		const controller = createController(getProfileActivity);

		const result = controller.getProfileActivity(query);

		expect(result).toBe(servicePromise);
		expect(getProfileActivity).toHaveBeenCalledTimes(1);
		expect(getProfileActivity).toHaveBeenCalledWith(query);
		await expect(result).resolves.toBe(response);
	});

	it('preserves the original service rejection identity', async () => {
		const error = new Error('profile activity read failed');
		const servicePromise = Promise.reject(error);
		const controller = createController(jest.fn(() => servicePromise));

		const result = controller.getProfileActivity(query);

		expect(result).toBe(servicePromise);
		await expect(result).rejects.toBe(error);
	});

	it('registers the controller once after the legacy controller without changing module dependencies', () => {
		expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, StatisticModule)).toEqual([
			StatisticController,
			ProfileActivityController
		]);
		expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, StatisticModule)).toEqual([
			RolePermissionModule,
			OrganizationProjectModule,
			TaskModule,
			TimeSlotModule,
			EmployeeModule,
			UserModule,
			ActivityModule,
			TimeLogModule
		]);
		expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, StatisticModule)).toEqual([StatisticService]);
		expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, StatisticModule)).toEqual([StatisticService]);
	});
});
