import '../core/entities/internal';

import { NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { EmployeeAgentProfileController } from './employee-agent-profile.controller';
import { EmployeeAgentProfileService } from './employee-agent-profile.service';

describe('EmployeeAgentProfileController', () => {
	const EMPLOYEE = 'e0000000-0000-4000-8000-000000000001';

	function controllerWith(profile: unknown) {
		const service = { findByEmployeeId: jest.fn().mockResolvedValue(profile) };
		return {
			service,
			controller: new EmployeeAgentProfileController(service as unknown as EmployeeAgentProfileService)
		};
	}

	it('answers the profile of an agent employee', async () => {
		const profile = { id: 'p-1', employeeId: EMPLOYEE, source: 'ever_works' };
		const { service, controller } = controllerWith(profile);
		await expect(controller.findByEmployeeId(EMPLOYEE)).resolves.toBe(profile);
		expect(service.findByEmployeeId).toHaveBeenCalledWith(EMPLOYEE);
	});

	it('answers 404 for an employee without a profile', async () => {
		const { controller } = controllerWith(null);
		await expect(controller.findByEmployeeId(EMPLOYEE)).rejects.toBeInstanceOf(NotFoundException);
	});

	it('requires the employee list permission', () => {
		const reflector = new Reflector();
		const handler = EmployeeAgentProfileController.prototype.findByEmployeeId;
		expect(reflector.get(PERMISSIONS_METADATA, handler)).toEqual([PermissionsEnum.ORG_EMPLOYEES_VIEW]);
		expect(reflector.get(PERMISSIONS_METADATA, EmployeeAgentProfileController)).toEqual([
			PermissionsEnum.ORG_EMPLOYEES_VIEW
		]);
	});
});
