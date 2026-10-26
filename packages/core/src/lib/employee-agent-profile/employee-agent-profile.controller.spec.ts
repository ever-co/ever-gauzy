import '../core/entities/internal';

import { NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { EmployeeAgentProfileController } from './employee-agent-profile.controller';
import { EmployeeAgentProfileService } from './employee-agent-profile.service';
import { OrganizationBelongsToUserConstraint } from '../shared/validators/constraints/organization-belongs-to-user.constraint';

describe('EmployeeAgentProfileController', () => {
	const EMPLOYEE = 'e0000000-0000-4000-8000-000000000001';

	const MINE = 'o0000000-0000-4000-8000-00000000000a';
	const THEIRS = 'o0000000-0000-4000-8000-00000000000b';

	function controllerWith(profile: unknown) {
		const service = { findByEmployeeId: jest.fn().mockResolvedValue(profile) };
		const membership = {
			checkOrganizationExistence: jest.fn(async (organizationId: string) => organizationId === MINE)
		};
		return {
			service,
			membership,
			controller: new EmployeeAgentProfileController(
				service as unknown as EmployeeAgentProfileService,
				membership as unknown as OrganizationBelongsToUserConstraint
			)
		};
	}

	it('answers the profile of an agent employee', async () => {
		const profile = { id: 'p-1', employeeId: EMPLOYEE, organizationId: MINE, source: 'ever_works' };
		const { service, controller, membership } = controllerWith(profile);
		await expect(controller.findByEmployeeId(EMPLOYEE)).resolves.toBe(profile);
		expect(service.findByEmployeeId).toHaveBeenCalledWith(EMPLOYEE);
		expect(membership.checkOrganizationExistence).toHaveBeenCalledWith(MINE);
	});

	it('answers 404 for an agent of another organization of the tenant, one the caller is not a member of (review F71)', async () => {
		const { controller } = controllerWith({
			id: 'p-2',
			employeeId: EMPLOYEE,
			organizationId: THEIRS,
			source: 'ever_works'
		});
		await expect(controller.findByEmployeeId(EMPLOYEE)).rejects.toBeInstanceOf(NotFoundException);
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
