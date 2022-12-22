import {
	Injectable,
	BadRequestException,
	HttpException,
	HttpStatus
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, In, ILike, SelectQueryBuilder } from 'typeorm';
import {
	IOrganizationTeamCreateInput,
	IOrganizationTeam,
	RolesEnum,
	IPagination,
	IOrganizationTeamUpdateInput,
	IRole,
	IEmployee,
	PermissionsEnum
} from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { Employee } from '../employee/employee.entity';
import { OrganizationTeam } from './organization-team.entity';
import { OrganizationTeamEmployee } from '../organization-team-employee/organization-team-employee.entity';
import { PaginationParams, TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { RoleService } from '../role/role.service';
import { OrganizationTeamEmployeeService } from '../organization-team-employee/organization-team-employee.service';

@Injectable()
export class OrganizationTeamService extends TenantAwareCrudService<OrganizationTeam> {

	constructor(
		@InjectRepository(OrganizationTeam)
		private readonly organizationTeamRepository: Repository<OrganizationTeam>,
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,
		private readonly roleService: RoleService,
		private readonly organizationTeamEmployeeService: OrganizationTeamEmployeeService
	) {
		super(organizationTeamRepository);
	}

	async create(
		entity: IOrganizationTeamCreateInput
	): Promise<IOrganizationTeam> {
		const { tags = [], memberIds = [], managerIds = [] } = entity;
		const { name, prefix, organizationId } = entity;
		try {
			const tenantId = RequestContext.currentTenantId();
			/**
			 * If, employee create teams, default add as a manager
			 */
			try {
				await this.roleService.findOneByIdString(RequestContext.currentRoleId(), {
					where: {
						name: RolesEnum.EMPLOYEE
					}
				});
				managerIds.push(RequestContext.currentEmployeeId());
			} catch (error) {}

			const employees = await this.employeeRepository.find({
				where: {
					id: In([...memberIds, ...managerIds]),
					organizationId,
					tenantId
				},
				relations: {
					user: true
				}
			});

			/**
			 * Get manager role
			 */
			const manager = await this.roleService.findOneByWhereOptions({
				name: RolesEnum.MANAGER
			});

			const members: OrganizationTeamEmployee[] = [];
			employees.forEach((employee: IEmployee) => {
				const employeeId = employee.id;
				members.push(new OrganizationTeamEmployee({
					employeeId,
					organizationId,
					tenantId,
					role: managerIds.includes(employeeId) ? manager : null
				}));
			});
			return await super.create({
				tags,
				organizationId,
				tenantId,
				name,
				prefix,
				members
			});
		} catch (error) {
			throw new BadRequestException(`Failed to create a team: ${error}`);
		}
	}

	async update(
		id: IOrganizationTeam['id'],
		entity: IOrganizationTeamUpdateInput
	): Promise<OrganizationTeam> {
		const { tags = [], memberIds = [], managerIds = [] } = entity;
		const { name, prefix, organizationId } = entity;
		try {
			const tenantId = RequestContext.currentTenantId();
			/**
			 * If, employee create teams, default add as a manager
			 */
			try {
				await this.roleService.findOneByIdString(RequestContext.currentRoleId(), {
					where: {
						name: RolesEnum.EMPLOYEE
					}
				});
				managerIds.push(RequestContext.currentEmployeeId());
			} catch (error) {}
			/**
			 * Get manager role
			 */
			const role = await this.roleService.findOneByWhereOptions({
				name: RolesEnum.MANAGER
			});

			const employees = await this.employeeRepository.find({
				where: {
					id: In([...memberIds, ...managerIds]),
					organizationId,
					tenantId
				},
				relations: {
					user: true
				}
			});

			// Update nested entity
			await this.organizationTeamEmployeeService.updateOrganizationTeam(
				id,
				organizationId,
				employees,
				role,
				managerIds,
				memberIds
			);

			const organizationTeam = await this.findOneByIdString(id);
			this.repository.merge(organizationTeam, { name, tags, prefix });

			return await this.repository.save(organizationTeam);
		} catch (err /*: WriteError*/) {
			throw new BadRequestException(err);
		}
	}

	async getMyOrgTeams(
		filter: FindManyOptions<OrganizationTeam>,
		employeeId: IEmployee['id']
	): Promise<IPagination<IOrganizationTeam>> {
		const teams: IOrganizationTeam[] = [];
		const items = await this.find(filter);
		for (const team of items) {
			if (isNotEmpty(team.members)) {
				for (const employee of team.members) {
					if (employeeId === employee.employeeId) {
						teams.push(team);
						break;
					}
				}
			}
		}
		return { items: teams, total: teams.length };
	}

	/**
	 * Find my teams
	 *
	 * @param params
	 * @returns
	 */
	public async findMyTeams(params: PaginationParams<any>): Promise<IPagination<OrganizationTeam>> {
		let role: IRole;
		try {
			const roleId = RequestContext.currentRoleId();
			role = await this.roleService.findOneByIdString(roleId);
		} catch (e) {}

		if (role.name === RolesEnum.ADMIN || role.name === RolesEnum.SUPER_ADMIN) {
			const { where } = params;
			if ('employeeId' in where) {
				const employeeId = where.employeeId;
				delete params.where.employeeId;

				return await this.getMyOrgTeams(params, employeeId);
			} else {
				return await super.findAll(params);
			}
		} else if (role.name === RolesEnum.EMPLOYEE) {
			const employeeId = RequestContext.currentEmployeeId();
			if (employeeId) {
				return await this.getMyOrgTeams(params, employeeId);
			}
		}
		throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
	}

	/**
	 * GET organization teams pagination by params
	 *
	 * @param filter
	 * @returns
	 */
	public async pagination(
		options?: PaginationParams<OrganizationTeam>
	): Promise<IPagination<OrganizationTeam>> {
		if ('where' in options) {
			const { where } = options;
			if ('name' in where) {
				options['where']['name'] = ILike(`%${where.name}%`);
			}
			if ('tags' in where) {
				options['where']['tags'] = {
					id: In(where.tags as [])
				}
			}
		}
		return await this.findAll(options);
	}

	/**
	 * GET organization teams by params
	 *
	 * @param options
	 * @returns
	 */
	public async findAll(
		options?: PaginationParams<OrganizationTeam>
	): Promise<IPagination<OrganizationTeam>> {
		const tenantId = RequestContext.currentTenantId();
		const employeeId = RequestContext.currentEmployeeId();

		const members = options.where.members;
		if ('members' in options.where) { delete options.where['members']; }

		const query = this.repository.createQueryBuilder(this.alias);
		// If employee has login and don't have permission to change employee
		if (employeeId && !RequestContext.hasPermission(
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		)) {
			// Sub query to get only employee assigned teams
			query.andWhere((cb: SelectQueryBuilder<OrganizationTeam>) => {
				const subQuery = cb.subQuery().select('"team"."organizationTeamId"').from('organization_team_employee', 'team');
				subQuery.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });

				if (isNotEmpty(options) && isNotEmpty(options.where)) {
					const { organizationId } = options.where;
					subQuery.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });
				}

				subQuery.andWhere('"team"."employeeId" = :employeeId', { employeeId });
				return '"organization_team"."id" IN ' + subQuery.distinct(true).getQuery();
			});
		} else {
			if (isNotEmpty(members) && isNotEmpty(members['employeeId'])) {
				// Sub query to get only employee assigned teams
				query.andWhere((cb: SelectQueryBuilder<OrganizationTeam>) => {
					const subQuery = cb.subQuery().select('"team"."organizationTeamId"').from('organization_team_employee', 'team');
					subQuery.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });

					if (isNotEmpty(options) && isNotEmpty(options.where)) {
						const { organizationId } = options.where;
						subQuery.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });
					}

					const employeeId = members['employeeId'];
					subQuery.andWhere('"team"."employeeId" = :employeeId', { employeeId });
					return '"organization_team"."id" IN ' + subQuery.distinct(true).getQuery();
				});
			}
		}
		if (isNotEmpty(options)) {
			query.setFindOptions({
				skip: options.skip ? (options.take * (options.skip - 1)) : 0,
				take: options.take ? (options.take) : 10
			});
			query.setFindOptions({
				...(
					(options.select) ? { select: options.select } : {}
				),
				...(
					(options.relations) ? { relations: options.relations } : {}
				),
				...(
					(options.where) ? { where: options.where } : {}
				),
				...(
					(options.order) ? { order: options.order } : {}
				)
			});
		}
		query.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
		const [items, total] = await query.getManyAndCount();
		return { items, total };
	}
}
