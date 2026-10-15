import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ID, IEmployeeAgentProfileInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { Employee } from '../core/entities/internal';
import { EmployeeAgentProfile } from './employee-agent-profile.entity';
import { TypeOrmEmployeeAgentProfileRepository } from './repository/type-orm-employee-agent-profile.repository';
import { MikroOrmEmployeeAgentProfileRepository } from './repository/mikro-orm-employee-agent-profile.repository';

/**
 * The profile members an integration may state. Everything that scopes or identifies the row — `id`, the
 * tenant, the organization, the employee — is decided by the service, never taken from the input.
 */
const PROFILE_INPUT_KEYS: ReadonlyArray<keyof IEmployeeAgentProfileInput> = [
	'source',
	'externalId',
	'slug',
	'title',
	'capabilities',
	'status',
	'scope',
	'scopeTargetId',
	'reportsToEmployeeId',
	'modelId',
	'avatarUrl',
	'lastRunAt',
	'managedExternally',
	'externalUrl',
	'metadata'
];

/**
 * Picks the members an integration may state from a profile input, dropping everything else.
 *
 * @param input The profile input.
 * @returns Only the allowed members that are present.
 */
export function pickAgentProfileInput(
	input: Partial<IEmployeeAgentProfileInput> = {}
): Partial<IEmployeeAgentProfileInput> {
	const picked: Partial<IEmployeeAgentProfileInput> = {};
	for (const key of PROFILE_INPUT_KEYS) {
		if (input[key] !== undefined) {
			(picked as Record<string, unknown>)[key] = input[key];
		}
	}
	return picked;
}

/**
 * Creates or updates the agent profile of an employee inside the caller's transaction.
 *
 * The tenant and organization come from the employee row, never from the input; `reportsToEmployeeId`,
 * when stated, must name another employee of the same tenant and organization. A new profile needs a
 * `source`.
 *
 * @param em The transaction to write inside.
 * @param employee The agent employee (must carry `id`, `tenantId` and `organizationId`).
 * @param input The profile members to write; members outside the allowed set are dropped.
 * @returns The stored profile.
 */
export async function writeAgentProfile(
	em: EntityManager,
	employee: Pick<Employee, 'id' | 'tenantId' | 'organizationId'>,
	input: Partial<IEmployeeAgentProfileInput>
): Promise<EmployeeAgentProfile> {
	const { id: employeeId, tenantId, organizationId } = employee;
	const values = pickAgentProfileInput(input);

	if (values.reportsToEmployeeId) {
		if (values.reportsToEmployeeId === employeeId) {
			throw new BadRequestException('An agent cannot report to itself.');
		}
		const reportsTo = await em.findOne(Employee, {
			where: { id: values.reportsToEmployeeId, tenantId, organizationId }
		});
		if (!reportsTo) {
			throw new BadRequestException('reportsToEmployeeId must name an employee of the same organization.');
		}
	}

	const existing = await em.findOne(EmployeeAgentProfile, { where: { employeeId, tenantId } });
	if (existing) {
		em.merge(EmployeeAgentProfile, existing, values as Partial<EmployeeAgentProfile>);
		return await em.save(EmployeeAgentProfile, existing);
	}

	if (!values.source) {
		throw new BadRequestException('An agent profile needs a source.');
	}

	const profile = em.create(EmployeeAgentProfile, {
		...values,
		source: values.source,
		employeeId,
		employee: { id: employeeId },
		tenantId,
		tenant: { id: tenantId },
		organizationId,
		organization: { id: organizationId }
	} as Partial<EmployeeAgentProfile>);
	return await em.save(EmployeeAgentProfile, profile);
}

/**
 * Reads and writes the agent profile of an agent employee (`employee_agent_profile`, one row per employee).
 *
 * Reads are tenant-scoped through `TenantAwareCrudService`. Writes are made by integrations through
 * {@link upsertForEmployee}, which takes the tenant and organization from the employee row rather than
 * from its input.
 */
@Injectable()
export class EmployeeAgentProfileService extends TenantAwareCrudService<EmployeeAgentProfile> {
	constructor(
		readonly typeOrmEmployeeAgentProfileRepository: TypeOrmEmployeeAgentProfileRepository,
		readonly mikroOrmEmployeeAgentProfileRepository: MikroOrmEmployeeAgentProfileRepository
	) {
		super(typeOrmEmployeeAgentProfileRepository, mikroOrmEmployeeAgentProfileRepository);
	}

	/**
	 * The agent profile of one employee of the caller's tenant, or `null` when the employee has none (a
	 * person, or an agent provisioned without a profile).
	 *
	 * @param employeeId The employee id.
	 * @returns The profile, or `null`.
	 */
	async findByEmployeeId(employeeId: ID): Promise<EmployeeAgentProfile | null> {
		// Tenant-scoped by the base service (the caller's tenant is added to the condition), on either ORM.
		// The employee filter is lifted: the profile read is about an agent, not about the caller, and the
		// route's ORG_EMPLOYEES_VIEW permission is what decides who may read it. Left on, a caller without
		// CHANGE_SELECTED_EMPLOYEE would have the named employee replaced by their own.
		const { success, record } = await this.withoutEmployeeFilter(() =>
			this.findOneOrFailByWhereOptions({ employeeId })
		);
		return success ? record : null;
	}

	/**
	 * Creates or updates the agent profile of an employee. Used by integrations (and by
	 * `EmployeeService.createAgentEmployee`), not by any route.
	 *
	 * The tenant and organization come from the employee row; `reportsToEmployeeId`, when stated, must name
	 * an employee of the same tenant and organization.
	 *
	 * @param employee The agent employee (must carry `id`, `tenantId` and `organizationId`).
	 * @param input The profile members to write.
	 * @param manager The transaction to write inside, when the caller has one.
	 * @returns The stored profile.
	 */
	async upsertForEmployee(
		employee: Pick<Employee, 'id' | 'tenantId' | 'organizationId'>,
		input: Partial<IEmployeeAgentProfileInput>,
		manager?: EntityManager
	): Promise<EmployeeAgentProfile> {
		const write = (em: EntityManager) => writeAgentProfile(em, employee, input);

		return manager ? write(manager) : this.typeOrmRepository.manager.transaction(write);
	}
}
