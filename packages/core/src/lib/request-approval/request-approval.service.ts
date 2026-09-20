import { Injectable, ConflictException } from '@nestjs/common';
import { Brackets, FindManyOptions, In } from 'typeorm';
import {
	IRequestApproval,
	RequestApprovalStatusTypesEnum,
	IRequestApprovalCreateInput,
	IRequestApprovalFindInput,
	IPagination,
	IRequestApprovalEmployee,
	IOrganizationTeam,
	IEmployee,
	IRequestApprovalTeam,
	ID
} from '@gauzy/contracts';
import { isBetterSqlite3, isMySQL, isPostgres, isSqlite } from '@gauzy/config';
import { prepareSQLQuery as p } from './../database/database.helper';
import { RequestContext } from '../core/context';
import { RequestApprovalEmployee, RequestApprovalTeam } from './../core/entities/internal';
import { TenantAwareCrudService } from './../core/crud';
import { assertSensitiveRelationsAllowed } from './../core/util/sensitive-relations.helper';
import { MultiORMEnum, parseFindOptionsRelations } from './../core/utils';
import { RequestApproval } from './request-approval.entity';
import { MikroOrmRequestApprovalRepository } from './repository/mikro-orm-request-approval.repository';
import { TypeOrmRequestApprovalRepository } from './repository/type-orm-request-approval.repository';
import { TypeOrmEmployeeRepository } from '../employee/repository/type-orm-employee.repository';
import { MikroOrmEmployeeRepository } from '../employee/repository/mikro-orm-employee.repository';
import { TypeOrmOrganizationTeamRepository } from '../organization-team/repository/type-orm-organization-team.repository';
import { MikroOrmOrganizationTeamRepository } from '../organization-team/repository/mikro-orm-organization-team.repository';

@Injectable()
export class RequestApprovalService extends TenantAwareCrudService<RequestApproval> {
	constructor(
		readonly typeOrmRequestApprovalRepository: TypeOrmRequestApprovalRepository,
		readonly mikroOrmRequestApprovalRepository: MikroOrmRequestApprovalRepository,
		readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		readonly mikroOrmEmployeeRepository: MikroOrmEmployeeRepository,
		readonly typeOrmOrganizationTeamRepository: TypeOrmOrganizationTeamRepository,
		readonly mikroOrmOrganizationTeamRepository: MikroOrmOrganizationTeamRepository
	) {
		super(typeOrmRequestApprovalRepository, mikroOrmRequestApprovalRepository);
	}

	async findAllRequestApprovals(
		filter: FindManyOptions<RequestApproval>,
		findInput: IRequestApprovalFindInput
	): Promise<IPagination<IRequestApproval>> {
		// Builds its own query, so the check in the CRUD read methods never runs: assert the
		// sensitive-relation table on the client-supplied relations before anything is loaded.
		this.assertRelationsPermitted(filter);

		const tenantId = RequestContext.currentTenantId();
		/*
		 * The scope of the read is the caller's, and the input narrows it rather than stating it: a
		 * register asked for without a filter is the register of the caller's own organization, which is
		 * how every other list of this platform is scoped. Reading the member straight out of the input
		 * left it `undefined` for the bare request the administration surface and the purchase-order flow
		 * both make, and every condition below then compared a column against nothing — so the register
		 * answered an empty list while the single read of the same row answered it in full.
		 */
		const organizationId = findInput?.organizationId ?? RequestContext.currentOrganizationId();

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const knex = this.mikroOrmRequestApprovalRepository.getKnex();
				const query = knex('request_approval')
					.withSchema(knex.userParams.schema)
					.as('request_approval')
					.select('request_approval.id');

				// Polymorphic join logic mirroring TypeORM implementation
				const timeOffRequestCheckIdQuery = `${
					isSqlite() || isBetterSqlite3()
						? '"time_off_request"."id" = "request_approval"."requestId"'
						: isPostgres()
						? '"time_off_request"."id"::text = "request_approval"."requestId"'
						: isMySQL()
						? 'CAST("time_off_request"."id" AS CHAR) = "request_approval"."requestId"'
						: '"time_off_request"."id" = "request_approval"."requestId"'
				}`;
				const equipmentSharingCheckIdQuery = `${
					isSqlite() || isBetterSqlite3()
						? '"equipment_sharing"."id" = "request_approval"."requestId"'
						: isPostgres()
						? '"equipment_sharing"."id"::text = "request_approval"."requestId"'
						: isMySQL()
						? 'CAST("equipment_sharing"."id" AS CHAR) = "request_approval"."requestId"'
						: '"equipment_sharing"."id" = "request_approval"."requestId"'
				}`;

				query.leftJoin(
					'approval_policy',
					'approval_policy',
					'approval_policy.id',
					'request_approval.approvalPolicyId'
				);
				query.leftJoin('time_off_request', (join) => join.on(knex.raw(timeOffRequestCheckIdQuery)));
				query.leftJoin('equipment_sharing', (join) => join.on(knex.raw(equipmentSharingCheckIdQuery)));

				query.where((qb) => {
					qb.where({ 'approval_policy.organizationId': organizationId, 'approval_policy.tenantId': tenantId })
						.orWhere({
							'time_off_request.organizationId': organizationId,
							'time_off_request.tenantId': tenantId
						})
						.orWhere({
							'equipment_sharing.organizationId': organizationId,
							'equipment_sharing.tenantId': tenantId
						})
						// A request raised in this organization belongs to it even when it names no
						// policy and no time-off / equipment-sharing record (e.g. a purchasing request).
						.orWhere({
							'request_approval.organizationId': organizationId,
							'request_approval.tenantId': tenantId
						});
				});

				const results = await query;
				const ids = results.map((r) => r.id);

				if (ids.length === 0) {
					return { items: [], total: 0 };
				}

				const relations = filter.relations as string[];
				const [items, total] = await this.mikroOrmRepository.findAndCount(
					{ id: { $in: ids } },
					{
						...(relations && relations.length > 0 ? { populate: relations as any[] } : {})
					}
				);
				return { items: items.map((e) => this.serialize(e)) as IRequestApproval[], total };
			}
			case MultiORMEnum.TypeORM:
			default: {
				const query = this.typeOrmRepository.createQueryBuilder('request_approval');
				query.leftJoinAndSelect(`${query.alias}.approvalPolicy`, 'approvalPolicy');

				const timeOffRequestCheckIdQuery = `${
					isSqlite() || isBetterSqlite3()
						? '"time_off_request"."id" = "request_approval"."requestId"'
						: isPostgres()
						? '"time_off_request"."id"::"varchar" = "request_approval"."requestId"'
						: isMySQL()
						? p(
								`CAST("time_off_request"."id" AS CHAR) COLLATE utf8mb4_unicode_ci = "request_approval"."requestId" COLLATE utf8mb4_unicode_ci`
						  )
						: '"time_off_request"."id" = "request_approval"."requestId"'
				}`;
				const equipmentSharingCheckIdQuery = `${
					isSqlite() || isBetterSqlite3()
						? '"equipment_sharing"."id" = "request_approval"."requestId"'
						: isPostgres()
						? '"equipment_sharing"."id"::"varchar" = "request_approval"."requestId"'
						: isMySQL()
						? p(
								`CAST(CONVERT("time_off_request"."id" USING utf8mb4) AS CHAR) = CAST(CONVERT("request_approval"."requestId" USING utf8mb4) AS CHAR)`
						  )
						: '"equipment_sharing"."id" = "request_approval"."requestId"'
				}`;

				query.leftJoinAndSelect('time_off_request', 'time_off_request', timeOffRequestCheckIdQuery);
				query.leftJoinAndSelect('equipment_sharing', 'equipment_sharing', equipmentSharingCheckIdQuery);

				const relations = filter.relations as string[];
				if (relations && relations.length > 0) {
					query.setFindOptions({ relations: parseFindOptionsRelations(relations) });
				}

				const [items, total] = await query
					.where(
						new Brackets((sqb) => {
							sqb.where(p('approvalPolicy.organizationId =:organizationId'), {
								organizationId
							}).andWhere(p('approvalPolicy.tenantId =:tenantId'), {
								tenantId
							});
						})
					)
					.orWhere(
						new Brackets((sqb) => {
							sqb.where(p('time_off_request.organizationId =:organizationId'), {
								organizationId
							}).andWhere(p('time_off_request.tenantId =:tenantId'), {
								tenantId
							});
						})
					)
					.orWhere(
						new Brackets((sqb) => {
							sqb.where(p('equipment_sharing.organizationId =:organizationId'), {
								organizationId
							}).andWhere(p('equipment_sharing.tenantId =:tenantId'), {
								tenantId
							});
						})
					)
					// A request raised in this organization belongs to it even when it names no policy
					// and no time-off / equipment-sharing record (e.g. a purchasing request).
					.orWhere(
						new Brackets((sqb) => {
							sqb.where(p('request_approval.organizationId =:organizationId'), {
								organizationId
							}).andWhere(p('request_approval.tenantId =:tenantId'), {
								tenantId
							});
						})
					)
					.getManyAndCount();

				return { items, total };
			}
		}
	}

	async findRequestApprovalsByEmployeeId(
		id: ID,
		relations: string[],
		findInput?: IRequestApprovalFindInput
	): Promise<IPagination<IRequestApproval>> {
		// Builds its own query, so the check in the CRUD read methods never runs: assert the
		// sensitive-relation table on the client-supplied relations before anything is loaded.
		// The relations are applied to the EMPLOYEE read below, so the table is walked from `Employee`.
		assertSensitiveRelationsAllowed(this.typeOrmEmployeeRepository.metadata, relations);

		// Get the current tenant ID and current user ID from the request context.
		const currentUserId = RequestContext.currentUserId();
		const tenantId = RequestContext.currentTenantId();

		// The same scope rule as the register's list: the input narrows the read, and the caller's own
		// organization is what it is narrowed to when the input states none.
		const organizationId = findInput?.organizationId ?? RequestContext.currentOrganizationId();
		const result = await this.find({
			where: {
				createdByUserId: currentUserId,
				organizationId,
				tenantId
			}
		});
		let requestApproval = [];
		let employee;
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				employee = await this.mikroOrmEmployeeRepository.findOne(id, {
					populate: relations as any
				});
				break;
			case MultiORMEnum.TypeORM:
			default:
                employee = await this.typeOrmEmployeeRepository.findOne({
					where: { id },
					relations: parseFindOptionsRelations(relations)
				});
				break;
		}

		if (employee && employee.requestApprovals && employee.requestApprovals.length > 0) {
			requestApproval = [...requestApproval, ...employee.requestApprovals];
		}

		for (const request of requestApproval) {
			const approval = await this.findOneByOptions({
				where: {
					id: request.requestApprovalId
				},
				relations: {
					approvalPolicy: true,
					employeeApprovals: true,
					teamApprovals: true,
					tags: true
				}
			});
			result.push(approval);
		}

		return { items: result, total: result.length };
	}

	/**
	 * Resolves the approver employees named by a request approval, inside the caller's tenant only.
	 *
	 * The ids come from the request body and the raw repositories carry no tenant scoping, so an
	 * unscoped lookup attached another tenant's employee (and echoed it back in the response)
	 * (GHSA-gwpq-mmw7-vx85 sibling). Ids of other tenants are ignored; no tenant means no match.
	 *
	 * @param ids - The employee ids from the request.
	 * @param tenantId - The caller's tenant.
	 */
	private async findEmployeesInTenant(ids: ID[], tenantId: ID): Promise<IEmployee[]> {
		if (!tenantId || !Array.isArray(ids) || !ids.length) {
			return [];
		}
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				return await this.mikroOrmEmployeeRepository.find({ id: { $in: ids }, tenantId } as any);
			case MultiORMEnum.TypeORM:
			default:
				return await this.typeOrmEmployeeRepository.find({ where: { id: In(ids), tenantId } });
		}
	}

	/**
	 * Resolves the approver teams named by a request approval, inside the caller's tenant only.
	 * See {@link findEmployeesInTenant}.
	 *
	 * @param ids - The team ids from the request.
	 * @param tenantId - The caller's tenant.
	 */
	private async findTeamsInTenant(ids: ID[], tenantId: ID): Promise<IOrganizationTeam[]> {
		if (!tenantId || !Array.isArray(ids) || !ids.length) {
			return [];
		}
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				return await this.mikroOrmOrganizationTeamRepository.find({ id: { $in: ids }, tenantId } as any);
			case MultiORMEnum.TypeORM:
			default:
				return await this.typeOrmOrganizationTeamRepository.find({ where: { id: In(ids), tenantId } });
		}
	}

	/**
	 * Creates a RequestApproval record.
	 *
	 * `requestId` and `requestType` are the polymorphic pair that attaches the request to the document
	 * it is about: `requestType` names the kind of document and `requestId` names the row, which is
	 * what lets an approver's list, a threshold policy and the document itself all resolve the same
	 * request without any of them owning a column on the other. A request filed without the pair
	 * exists, but nothing can say what it is about.
	 *
	 * @param entity - The input data to create a RequestApproval.
	 * @returns The saved RequestApproval entity.
	 */
	async createRequestApproval(entity: IRequestApprovalCreateInput): Promise<RequestApproval> {
		// Get the current tenant ID and current user ID from the request context.
		const tenantId = RequestContext.currentTenantId();

		const requestApproval = new RequestApproval();
		requestApproval.status = RequestApprovalStatusTypesEnum.REQUESTED;
		requestApproval.approvalPolicyId = entity.approvalPolicyId;
		requestApproval.name = entity.name;
		requestApproval.min_count = entity.min_count;
		requestApproval.requestId = entity.requestId;
		requestApproval.requestType = entity.requestType;
		requestApproval.amount = entity.amount;
		requestApproval.currency = entity.currency;
		requestApproval.note = entity.note;
		requestApproval.tags = entity.tags;
		requestApproval.organizationId = entity.organizationId;
		requestApproval.tenantId = tenantId;

		if (entity.employeeApprovals?.length) {
			const employees = await this.findEmployeesInTenant(entity.employeeApprovals as unknown as ID[], tenantId);

			requestApproval.employeeApprovals = employees.map((employee) => {
				const requestApprovalEmployee = new RequestApprovalEmployee();
				requestApprovalEmployee.employeeId = employee.id;
				requestApprovalEmployee.organizationId = entity.organizationId;
				requestApprovalEmployee.tenantId = tenantId;
				requestApprovalEmployee.status = RequestApprovalStatusTypesEnum.REQUESTED;
				return requestApprovalEmployee;
			});
		}

		if (entity.teams?.length) {
			const teams = await this.findTeamsInTenant(entity.teams as unknown as ID[], tenantId);

			requestApproval.teamApprovals = teams.map((team) => {
				const requestApprovalTeam = new RequestApprovalTeam();
				requestApprovalTeam.teamId = team.id;
				requestApprovalTeam.team = team;
				requestApprovalTeam.status = RequestApprovalStatusTypesEnum.REQUESTED;
				requestApprovalTeam.organizationId = entity.organizationId;
				requestApprovalTeam.tenantId = tenantId;
				return requestApprovalTeam;
			});
		}

		return this.save(requestApproval);
	}

	async updateRequestApproval(id: string, entity: IRequestApprovalCreateInput): Promise<RequestApproval> {
		const tenantId = RequestContext.currentTenantId();
		const requestApproval = await this.findOneByIdString(id);
		requestApproval.name = entity.name;
		requestApproval.status = RequestApprovalStatusTypesEnum.REQUESTED;
		requestApproval.approvalPolicyId = entity.approvalPolicyId;
		requestApproval.min_count = entity.min_count;
		requestApproval.tags = entity.tags;
		requestApproval.organizationId = entity.organizationId;
		requestApproval.tenantId = tenantId;

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				// MikroORM: Use nativeDelete on the entity manager
				const em = this.mikroOrmRepository.getEntityManager();
				await em.nativeDelete(RequestApprovalEmployee, { requestApprovalId: id } as any);
				await em.nativeDelete(RequestApprovalTeam, { requestApprovalId: id } as any);
				break;
			}
			case MultiORMEnum.TypeORM:
			default: {
				await this.typeOrmRepository
					.createQueryBuilder()
					.delete()
					.from(RequestApprovalEmployee)
					.where(p('requestApprovalId = :id'), { id: id })
					.execute();

				await this.typeOrmRepository
					.createQueryBuilder()
					.delete()
					.from(RequestApprovalTeam)
					.where(p('requestApprovalId = :id'), { id: id })
					.execute();
				break;
			}
		}

		if (entity.employeeApprovals) {
			const employees = await this.findEmployeesInTenant(entity.employeeApprovals as unknown as ID[], tenantId);
			const requestApprovalEmployees: IRequestApprovalEmployee[] = [];
			employees.forEach((employee) => {
				const raEmployees = new RequestApprovalEmployee();
				raEmployees.employeeId = employee.id;
				raEmployees.employee = employee;
				raEmployees.organizationId = entity.organizationId;
				raEmployees.tenantId = tenantId;
				raEmployees.status = RequestApprovalStatusTypesEnum.REQUESTED;
				requestApprovalEmployees.push(raEmployees);
			});
			requestApproval.employeeApprovals = requestApprovalEmployees;
		}

		if (entity.teams) {
			const teams = await this.findTeamsInTenant(entity.teams as unknown as ID[], tenantId);
			const requestApprovalTeams: IRequestApprovalTeam[] = [];
			teams.forEach((team) => {
				const raTeam = new RequestApprovalTeam();
				raTeam.teamId = team.id;
				raTeam.team = team;
				raTeam.status = RequestApprovalStatusTypesEnum.REQUESTED;
				raTeam.organizationId = entity.organizationId;
				raTeam.tenantId = tenantId;
				requestApprovalTeams.push(raTeam);
			});
			requestApproval.teamApprovals = requestApprovalTeams;
		}

		return this.save(requestApproval);
	}

	async updateStatusRequestApprovalByAdmin(id: string, status: number): Promise<RequestApproval> {
		const requestApproval = await this.findOneByIdString(id, {
			relations: {
				approvalPolicy: true
			}
		});

		// if (
		// 	requestApproval.status ===
		// 		RequestApprovalStatusTypesEnum.APPROVED ||
		// 	requestApproval.status ===
		// 		RequestApprovalStatusTypesEnum.REFUSED
		// ) {
		// 	throw new ConflictException('Request Approval is Conflict');
		// }

		requestApproval.status = status;

		return this.save(requestApproval);
	}

	async updateStatusRequestApprovalByEmployeeOrTeam(id: string, status: number): Promise<RequestApproval> {
		let minCount = 0;
		const employeeId = RequestContext.currentUser().employeeId;
		const requestApproval = await this.findOneByIdString(id, {
			relations: {
				employeeApprovals: true,
				teamApprovals: true
			}
		});

		if (
			requestApproval.status === RequestApprovalStatusTypesEnum.APPROVED ||
			requestApproval.status === RequestApprovalStatusTypesEnum.REFUSED
		) {
			throw new ConflictException('Request Approval is Conflict');
		}

		if (requestApproval.employeeApprovals && requestApproval.employeeApprovals.length > 0) {
			requestApproval.employeeApprovals.forEach((req) => {
				if (req.employeeId === employeeId) {
					req.status = status;
				}
				if (req.status === RequestApprovalStatusTypesEnum.APPROVED) {
					minCount++;
				}
			});
		}

		if (status === RequestApprovalStatusTypesEnum.REFUSED) {
			requestApproval.status = RequestApprovalStatusTypesEnum.REFUSED;
		} else if (minCount >= requestApproval.min_count) {
			requestApproval.status = RequestApprovalStatusTypesEnum.APPROVED;
		}

		return this.save(requestApproval);
	}
}
