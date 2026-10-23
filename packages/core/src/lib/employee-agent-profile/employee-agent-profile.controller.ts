import { Controller, Get, HttpStatus, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UUIDValidationPipe } from '../shared/pipes';
import { OrganizationBelongsToUserConstraint } from '../shared/validators/constraints/organization-belongs-to-user.constraint';
import { EmployeeAgentProfile } from './employee-agent-profile.entity';
import { EmployeeAgentProfileService } from './employee-agent-profile.service';

/**
 * The agent profile of an agent employee, under the employee it belongs to: `GET /employee/:id/agent-profile`.
 *
 * Read-only: profiles are written by integrations (`EmployeeService.createAgentEmployee`,
 * `EmployeeAgentProfileService.upsertForEmployee`), never by a route. The read carries the employee
 * list's own permission and is scoped to the caller's tenant and to the organizations the caller belongs to
 * (the rule the other employee reads get from `@IsOrganizationBelongsToUser()`, review F71).
 */
@ApiTags('Employee')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_EMPLOYEES_VIEW)
@Controller('/employee')
export class EmployeeAgentProfileController {
	constructor(
		private readonly employeeAgentProfileService: EmployeeAgentProfileService,
		private readonly organizationMembership: OrganizationBelongsToUserConstraint
	) {}

	/**
	 * GET the agent profile of one employee of the caller's tenant.
	 *
	 * @param id The employee id.
	 * @returns The agent profile.
	 * @throws NotFoundException when the employee has no agent profile (a person, or an employee of another tenant),
	 * or the profile belongs to an organization the caller is not a member of (it reads as missing).
	 */
	@ApiOperation({ summary: 'Get the agent profile of an agent employee' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The agent profile.', type: EmployeeAgentProfile })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'The employee has no agent profile.' })
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_VIEW)
	@Get('/:id/agent-profile')
	async findByEmployeeId(@Param('id', UUIDValidationPipe) id: ID): Promise<EmployeeAgentProfile> {
		const profile = await this.employeeAgentProfileService.findByEmployeeId(id);
		// The service reads by tenant only: another organization's agent is not the caller's to read (review F71).
		if (
			!profile ||
			!profile.organizationId ||
			!(await this.organizationMembership.checkOrganizationExistence(profile.organizationId))
		) {
			throw new NotFoundException('The employee has no agent profile.');
		}
		return profile;
	}
}
