import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, Equal, IsNull, Or } from 'typeorm';
import {
	ID,
	IOrganizationProjectRates,
	IOrganizationProjectRateUpdateInput,
	IRepricedTimeLogs,
	PermissionsEnum
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { Organization, OrganizationProjectEmployee } from '../core/entities/internal';
import { isSameId } from '../employee/own-rates';
import { assertCurrentUserBelongsToOrganization } from '../user-organization/assert-organization-membership';
import { OrganizationProject } from './organization-project.entity';
import { TypeOrmOrganizationProjectRepository } from './repository/type-orm-organization-project.repository';
import { TypeOrmOrganizationProjectEmployeeRepository } from './repository/type-orm-organization-project-employee.repository';
import {
	keepsTimeLogRates,
	RepricedTime,
	repriceMemberProjectTime,
	repriceProjectTime
} from '../time-tracking/time-log/time-log-repricing';

/** A membership left inactive or archived no longer ties the employee to the project (NULL counts as current). */
export const CURRENT_MEMBERSHIP = {
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
	): Promise<Pick<IOrganizationProjectRates, 'id' | 'billRateValue' | 'currency'> & IRepricedTimeLogs> {
		const tenantId = RequestContext.currentTenantId();
		const { organizationId, billRateValue } = input;
		await this.assertMayManageRates(projectId, organizationId, tenantId);
		const project = await this.findProject(projectId, organizationId, tenantId);
		const currency = await this.ratesCurrencyOf(project, organizationId, tenantId);
		const where = { id: project.id, organizationId, tenantId };

		const time = await this.repricedTimeOf(input, tenantId);
		if (!time) {
			await this.typeOrmOrganizationProjectRepository.update(where, { billRateValue });
			return { id: project.id, billRateValue, currency };
		}
		// The time logs store the currency the rate is in, as they are recorded with
		const repricedTimeLogs = await this.inOneTransaction(async (manager) => {
			await manager.update(OrganizationProject, where, { billRateValue });
			return await repriceProjectTime(manager, time, project.id, { billRateValue, currency });
		});
		return { id: project.id, billRateValue, currency, repricedTimeLogs };
	}

	/**
	 * The time a client rate change re-prices: with a day, the organization's time logs started on or after it. Without
	 * one, all the time already tracked, as before time logs stored their rates, unless the organization's time logs
	 * keep their rates: then none (null), and only time recorded from then on takes the new rate.
	 */
	private async repricedTimeOf(
		input: IOrganizationProjectRateUpdateInput,
		tenantId: ID
	): Promise<RepricedTime | null> {
		const organization = { tenantId, organizationId: input.organizationId };
		if (input.applyFrom) {
			return { ...organization, from: new Date(input.applyFrom) };
		}
		const keepsTheirRates = await keepsTimeLogRates(
			this.typeOrmOrganizationProjectRepository.manager,
			organization
		);
		if (keepsTheirRates) {
			return null;
		}
		return { ...organization, from: null };
	}

	/**
	 * Writes a rate change and the time it re-prices in one transaction (see time-log-repricing.ts): a failed
	 * re-pricing leaves the previous rate, and two changes of the same rate run one after the other on its row.
	 */
	private async inOneTransaction(work: (manager: EntityManager) => Promise<number>): Promise<number> {
		return await this.typeOrmOrganizationProjectRepository.manager.transaction(work);
	}

	async updateMemberRate(
		projectId: ID,
		employeeId: ID,
		input: IOrganizationProjectRateUpdateInput
	): Promise<{ organizationProjectId: ID; employeeId: ID; billRateValue: number | null } & IRepricedTimeLogs> {
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

		const where = { id: membership.id, tenantId };
		const time = await this.repricedTimeOf(input, tenantId);
		if (!time) {
			await this.typeOrmOrganizationProjectEmployeeRepository.update(where, { billRateValue });
			return { organizationProjectId: projectId, employeeId, billRateValue };
		}
		const project = await this.findProject(projectId, organizationId, tenantId);
		const currency = await this.ratesCurrencyOf(project, organizationId, tenantId);
		const repricedTimeLogs = await this.inOneTransaction(async (manager) => {
			await manager.update(OrganizationProjectEmployee, where, { billRateValue });
			return await repriceMemberProjectTime(manager, time, projectId, employeeId, { billRateValue, currency });
		});
		return { organizationProjectId: projectId, employeeId, billRateValue, repricedTimeLogs };
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
