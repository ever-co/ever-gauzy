import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Equal, IsNull, Or } from 'typeorm';
import { ID, IOrganizationProjectRates, IOrganizationProjectRateUpdateInput, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { Organization } from '../core/entities/internal';
import { isSameId } from '../employee/own-rates';
import { assertCurrentUserBelongsToOrganization } from '../user-organization/assert-organization-membership';
import { OrganizationProject } from './organization-project.entity';
import { TypeOrmOrganizationProjectRepository } from './repository/type-orm-organization-project.repository';
import { TypeOrmOrganizationProjectEmployeeRepository } from './repository/type-orm-organization-project-employee.repository';

/** A membership left inactive or archived no longer ties the employee to the project (NULL counts as current). */
const CURRENT_MEMBERSHIP = {
	isActive: Or(IsNull(), Equal(true)),
	isArchived: Or(IsNull(), Equal(false))
};

/**
 * The client rates of a project and of its members on it: what the client is billed per hour of the project's time,
 * in the project's currency, else the organization's. They are not what members are paid, which stays their own rate.
 * They are written by someone who may edit every employee, or by a manager an admin flagged on that project
 * (`organization_project_employee.isManager`). The MANAGER role alone does not count: any employee who creates a
 * project holds it, over the colleagues they add.
 */
@Injectable()
export class OrganizationProjectRateService {
	constructor(
		private readonly typeOrmOrganizationProjectRepository: TypeOrmOrganizationProjectRepository,
		private readonly typeOrmOrganizationProjectEmployeeRepository: TypeOrmOrganizationProjectEmployeeRepository
	) {}

	async findProjectRates(projectId: ID, organizationId: ID): Promise<IOrganizationProjectRates> {
		const tenantId = RequestContext.currentTenantId();
		await this.assertMayManageRates(projectId, organizationId, tenantId);
		const project = await this.findProject(projectId, organizationId, tenantId);

		const memberships = await this.typeOrmOrganizationProjectEmployeeRepository.find({
			where: { organizationProjectId: projectId, organizationId, tenantId, ...CURRENT_MEMBERSHIP },
			select: { id: true, employeeId: true, billRateValue: true }
		});
		const members = memberships.map((membership) => ({
			employeeId: membership.employeeId,
			billRateValue: membership.billRateValue ?? null
		}));
		const currency = await this.ratesCurrencyOf(project, organizationId, tenantId);
		return {
			id: project.id,
			billRateValue: project.billRateValue ?? null,
			currency,
			members
		};
	}

	async updateProjectRate(
		projectId: ID,
		input: IOrganizationProjectRateUpdateInput
	): Promise<Pick<IOrganizationProjectRates, 'id' | 'billRateValue' | 'currency'>> {
		const tenantId = RequestContext.currentTenantId();
		const { organizationId, billRateValue } = input;
		await this.assertMayManageRates(projectId, organizationId, tenantId);
		const project = await this.findProject(projectId, organizationId, tenantId);

		await this.typeOrmOrganizationProjectRepository.update(
			{ id: project.id, organizationId, tenantId },
			{ billRateValue }
		);
		const currency = await this.ratesCurrencyOf(project, organizationId, tenantId);
		return { id: project.id, billRateValue, currency };
	}

	async updateMemberRate(
		projectId: ID,
		employeeId: ID,
		input: IOrganizationProjectRateUpdateInput
	): Promise<{ organizationProjectId: ID; employeeId: ID; billRateValue: number | null }> {
		const tenantId = RequestContext.currentTenantId();
		const { organizationId, billRateValue } = input;
		const managerEmployeeId = await this.assertMayManageRates(projectId, organizationId, tenantId);
		await this.findProject(projectId, organizationId, tenantId);

		// What the client is billed for a manager's own time is an admin's call. The ids are compared as uuids
		// (case-insensitively), as the database matches them: a manager's own id sent in upper case is still their own.
		const setsOwnRate = isSameId(managerEmployeeId, employeeId);
		if (setsOwnRate) {
			throw new ForbiddenException('A project manager cannot set their own rate on the project. Ask an admin.');
		}

		const membership = await this.typeOrmOrganizationProjectEmployeeRepository.findOne({
			where: { organizationProjectId: projectId, employeeId, organizationId, tenantId, ...CURRENT_MEMBERSHIP },
			select: { id: true }
		});
		if (!membership) {
			throw new NotFoundException('This employee is not a member of the project.');
		}

		await this.typeOrmOrganizationProjectEmployeeRepository.update(
			{ id: membership.id, tenantId },
			{ billRateValue }
		);
		return { organizationProjectId: projectId, employeeId, billRateValue };
	}

	/** The currency a project's client rates are in: the project's own, else the organization's. */
	private async ratesCurrencyOf(
		project: OrganizationProject,
		organizationId: ID,
		tenantId: ID
	): Promise<string | null> {
		if (project.currency) {
			return project.currency;
		}
		const organization = await this.typeOrmOrganizationProjectRepository.manager.findOne(Organization, {
			where: { id: organizationId, tenantId },
			select: { id: true, currency: true }
		});
		return organization?.currency ?? null;
	}

	private async findProject(projectId: ID, organizationId: ID, tenantId: ID): Promise<OrganizationProject> {
		const project = await this.typeOrmOrganizationProjectRepository.findOne({
			where: { id: projectId, organizationId, tenantId },
			select: { id: true, billRateValue: true, currency: true }
		});
		if (!project) {
			throw new NotFoundException('Organization project not found.');
		}
		return project;
	}

	/**
	 * Refuses a caller who may not manage the project's rates.
	 *
	 * @returns The caller's employee when they are let in as the project's manager, `null` for an admin.
	 * @throws ForbiddenException for anyone else.
	 */
	private async assertMayManageRates(projectId: ID, organizationId: ID, tenantId: ID): Promise<ID | null> {
		await assertCurrentUserBelongsToOrganization(this.typeOrmOrganizationProjectRepository.manager, organizationId);

		const editsEveryEmployee =
			RequestContext.hasPermission(PermissionsEnum.ORG_EMPLOYEES_EDIT) ||
			RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
		if (editsEveryEmployee) {
			return null;
		}

		const employeeId = RequestContext.currentEmployeeId();
		if (!employeeId) {
			throw new ForbiddenException('Only an admin or a manager of the project manages its rates.');
		}
		const managesProject = await this.typeOrmOrganizationProjectEmployeeRepository.exists({
			where: {
				organizationProjectId: projectId,
				employeeId,
				organizationId,
				tenantId,
				isManager: true,
				...CURRENT_MEMBERSHIP
			}
		});
		if (!managesProject) {
			throw new ForbiddenException('Only an admin or a manager of the project manages its rates.');
		}
		return employeeId;
	}
}
