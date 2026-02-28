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
import { MultiORMEnum } from './../core/utils';
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
		const tenantId = RequestContext.currentTenantId();
		const { organizationId } = findInput;

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
					query.setFindOptions({ relations });
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
		// Get the current tenant ID and current user ID from the request context.
		const currentUserId = RequestContext.currentUserId();
		const tenantId = RequestContext.currentTenantId();

		const { organizationId } = findInput;
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
					relations
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
	 * Creates a RequestApproval record.
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
		requestApproval.tags = entity.tags;
		requestApproval.organizationId = entity.organizationId;
		requestApproval.tenantId = tenantId;

		if (entity.employeeApprovals?.length) {
			let employees: IEmployee[];
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					employees = await this.mikroOrmEmployeeRepository.find({
						id: { $in: entity.employeeApprovals as any }
					});
					break;
				case MultiORMEnum.TypeORM:
				default:
					employees = await this.typeOrmEmployeeRepository.find({
						where: { id: In(entity.employeeApprovals as any) }
					});
					break;
			}

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
			let teams: IOrganizationTeam[];
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					teams = await this.mikroOrmOrganizationTeamRepository.find({ id: { $in: entity.teams as any } });
					break;
				case MultiORMEnum.TypeORM:
				default:
					teams = await this.typeOrmOrganizationTeamRepository.find({
						where: { id: In(entity.teams as any) }
					});
					break;
			}

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
			let employees: IEmployee[];
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					employees = await this.mikroOrmEmployeeRepository.find({
						id: { $in: entity.employeeApprovals as any }
					});
					break;
				case MultiORMEnum.TypeORM:
				default:
					employees = await this.typeOrmEmployeeRepository.find({
						where: {
							id: In(entity.employeeApprovals as any)
						}
					});
					break;
			}
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
			let teams: IOrganizationTeam[];
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					teams = await this.mikroOrmOrganizationTeamRepository.find({ id: { $in: entity.teams as any } });
					break;
				case MultiORMEnum.TypeORM:
				default:
					teams = await this.typeOrmOrganizationTeamRepository.find({
						where: {
							id: In(entity.teams as any)
						}
					});
					break;
			}
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
