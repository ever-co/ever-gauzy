import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Equal, IsNull, Or } from 'typeorm';
import {
	ID,
	IEmployeeProjectRate,
	IOrganizationProjectRates,
	IOrganizationProjectRateUpdateInput,
	PermissionsEnum
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { Organization } from '../core/entities/internal';
import { TypeOrmEmployeeRepository } from '../employee/repository/type-orm-employee.repository';
import { OrganizationProject } from './organization-project.entity';
import { OrganizationProjectEmployee } from './organization-project-employee.entity';
import { TypeOrmOrganizationProjectRepository } from './repository/type-orm-organization-project.repository';
import { TypeOrmOrganizationProjectEmployeeRepository } from './repository/type-orm-organization-project-employee.repository';
import { effectiveBillRate, effectiveBillRateCurrency, effectiveBillRateSource } from './project-rates';

/** A membership left inactive or archived no longer ties the employee to the project (NULL counts as current). */
const CURRENT_MEMBERSHIP = {
	isActive: Or(IsNull(), Equal(true)),
	isArchived: Or(IsNull(), Equal(false))
};

/**
 * The rates of a project and of its members on it. They change what the organization owes for the time, so they are
 * written by someone who may edit every employee, or by a manager an admin flagged on that project
 * (`organization_project_employee.isManager`). The MANAGER role alone does not count: any employee who creates a
 * project holds it, over the colleagues they add.
 */
@Injectable()
export class OrganizationProjectRateService {
	constructor(
		private readonly typeOrmOrganizationProjectRepository: TypeOrmOrganizationProjectRepository,
		private readonly typeOrmOrganizationProjectEmployeeRepository: TypeOrmOrganizationProjectEmployeeRepository,
		private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository
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
		return {
			id: project.id,
			billRateValue: project.billRateValue ?? null,
			currency: project.currency ?? null,
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
		return { id: project.id, billRateValue, currency: project.currency ?? null };
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

		// A manager would otherwise raise their own pay on the project they manage
		const setsOwnRate = managerEmployeeId === employeeId;
		if (setsOwnRate) {
			throw new ForbiddenException('A project manager cannot set their own rate on the project. Ask an admin.');
		}

		const membership = await this.typeOrmOrganizationProjectEmployeeRepository.findOne({
			where: { organizationProjectId: projectId, employeeId, organizationId, tenantId },
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

	/**
	 * The caller's rates on the projects they are a member of: on each, the rate their time is counted at and its
	 * currency. Any employee reads their own.
	 */
	async findMyProjectRates(organizationId: ID): Promise<IEmployeeProjectRate[]> {
		const tenantId = RequestContext.currentTenantId();
		const employeeId = RequestContext.currentUser()?.employeeId;
		if (!employeeId) {
			return [];
		}

		const employee = await this.typeOrmEmployeeRepository.findOne({
			where: { id: employeeId, organizationId, tenantId },
			select: { id: true, billRateValue: true, billRateCurrency: true }
		});
		if (!employee) {
			return [];
		}

		const memberships = await this.typeOrmOrganizationProjectEmployeeRepository.find({
			where: { employeeId, organizationId, tenantId, ...CURRENT_MEMBERSHIP },
			relations: { organizationProject: true }
		});
		const projectMemberships = memberships.filter((membership) => isOpenProject(membership.organizationProject));
		const organizationCurrency = await this.findOrganizationCurrency(organizationId, tenantId);

		return projectMemberships.map((membership) =>
			myRateOn(membership, employee.billRateValue, employee.billRateCurrency, organizationCurrency)
		);
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

	private async findOrganizationCurrency(organizationId: ID, tenantId: ID): Promise<string | null> {
		const organization = await this.typeOrmOrganizationProjectRepository.manager.findOne(Organization, {
			where: { id: organizationId, tenantId },
			select: { id: true, currency: true }
		});
		return organization?.currency ?? null;
	}
}

function isOpenProject(project: OrganizationProject | undefined): boolean {
	if (!project) {
		return false;
	}
	return project.isArchived !== true;
}

function myRateOn(
	membership: OrganizationProjectEmployee,
	employeeRate: number | null | undefined,
	employeeCurrency: string | null | undefined,
	organizationCurrency: string | null
): IEmployeeProjectRate {
	const project = membership.organizationProject;
	const rates = { memberRate: membership.billRateValue, projectRate: project.billRateValue, employeeRate };
	const source = effectiveBillRateSource(rates);
	const currency = effectiveBillRateCurrency(source, {
		projectCurrency: project.currency,
		employeeCurrency,
		organizationCurrency
	});
	return {
		organizationProjectId: project.id,
		projectName: project.name,
		billRateValue: effectiveBillRate(rates),
		currency
	};
}
