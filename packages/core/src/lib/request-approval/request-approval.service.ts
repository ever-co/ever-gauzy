import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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
	IRequestApprovalTeam
} from '@gauzy/contracts';
import { isBetterSqlite3, isMySQL, isPostgres, isSqlite } from '@gauzy/config';
import { prepareSQLQuery as p } from './../database/database.helper';
import { RequestContext } from '../core/context';
import { Employee, OrganizationTeam, RequestApprovalEmployee, RequestApprovalTeam } from './../core/entities/internal';
import { TenantAwareCrudService } from './../core/crud';
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
		@InjectRepository(RequestApproval)
		typeOrmRequestApprovalRepository: TypeOrmRequestApprovalRepository,

		mikroOrmRequestApprovalRepository: MikroOrmRequestApprovalRepository,

		@InjectRepository(Employee)
		private typeOrmEmployeeRepository: TypeOrmEmployeeRepository,

		mikroOrmEmployeeRepository: MikroOrmEmployeeRepository,

		@InjectRepository(OrganizationTeam)
		private typeOrmOrganizationTeamRepository: TypeOrmOrganizationTeamRepository,

		mikroOrmOrganizationTeamRepository: MikroOrmOrganizationTeamRepository
	) {
		super(typeOrmRequestApprovalRepository, mikroOrmRequestApprovalRepository);
	}

	async findAllRequestApprovals(
		filter: FindManyOptions<RequestApproval>,
		findInput: IRequestApprovalFindInput
	): Promise<IPagination<IRequestApproval>> {
		const query = this.typeOrmRepository.createQueryBuilder('request_approval');
		query.leftJoinAndSelect(`${query.alias}.approvalPolicy`, 'approvalPolicy');

		const timeOffRequestCheckIdQuery = `${isSqlite() || isBetterSqlite3()
			? '"time_off_request"."id" = "request_approval"."requestId"'
			: isPostgres()
				? '"time_off_request"."id"::"varchar" = "request_approval"."requestId"'
				: isMySQL()
					? p(
						`CAST("time_off_request"."id" AS CHAR) COLLATE utf8mb4_unicode_ci = "request_approval"."requestId" COLLATE utf8mb4_unicode_ci`
					)
					: '"time_off_request"."id" = "request_approval"."requestId"'
			}`;
		const equipmentSharingCheckIdQuery = `${isSqlite() || isBetterSqlite3()
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

		const tenantId = RequestContext.currentTenantId();
		const { organizationId } = findInput;

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

	async findRequestApprovalsByEmployeeId(
		id: string,
		relations: string[],
		findInput?: IRequestApprovalFindInput
	): Promise<IPagination<IRequestApproval>> {
		const tenantId = RequestContext.currentTenantId();
		const currentUser = RequestContext.currentUser();

		const { organizationId } = findInput;
		const result = await this.typeOrmRepository.find({
			where: {
				createdBy: currentUser.id,
				organizationId,
				tenantId
			}
		});
		let requestApproval = [];
		const [employee] = await this.typeOrmEmployeeRepository.find({
			where: {
				id
			},
			relations
		});
		if (employee && employee.requestApprovals && employee.requestApprovals.length > 0) {
			requestApproval = [...requestApproval, ...employee.requestApprovals];
		}

		for (const request of requestApproval) {
			const approval = await this.typeOrmRepository.findOne({
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

	async createRequestApproval(entity: IRequestApprovalCreateInput): Promise<RequestApproval> {
		const tenantId = RequestContext.currentTenantId();
		const requestApproval = new RequestApproval();
		requestApproval.status = RequestApprovalStatusTypesEnum.REQUESTED;
		requestApproval.approvalPolicyId = entity.approvalPolicyId;
		requestApproval.createdBy = RequestContext.currentUser().id;
		requestApproval.createdByName = RequestContext.currentUser().name;
		requestApproval.name = entity.name;
		requestApproval.min_count = entity.min_count;
		requestApproval.tags = entity.tags;
		requestApproval.organizationId = entity.organizationId;
		requestApproval.tenantId = tenantId;
		if (entity.employeeApprovals) {
			const employees: IEmployee[] = await this.typeOrmEmployeeRepository.find({
				where: {
					id: In(entity.employeeApprovals)
				}
			});
			const requestApprovalEmployees: IRequestApprovalEmployee[] = [];
			employees.forEach((employee: IEmployee) => {
				const raEmployees = new RequestApprovalEmployee();
				raEmployees.employeeId = employee.id;
				raEmployees.organizationId = entity.organizationId;
				raEmployees.tenantId = tenantId;
				raEmployees.status = RequestApprovalStatusTypesEnum.REQUESTED;
				requestApprovalEmployees.push(raEmployees);
			});
			requestApproval.employeeApprovals = requestApprovalEmployees;
		}
		if (entity.teams) {
			const teams: IOrganizationTeam[] = await this.typeOrmOrganizationTeamRepository.find({
				where: {
					id: In(entity.teams)
				}
			});
			const requestApprovalTeams: RequestApprovalTeam[] = [];
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
		return this.typeOrmRepository.save(requestApproval);
	}
	async updateRequestApproval(id: string, entity: IRequestApprovalCreateInput): Promise<RequestApproval> {
		const tenantId = RequestContext.currentTenantId();
		const requestApproval = await this.typeOrmRepository.findOneBy({
			id
		});
		requestApproval.name = entity.name;
		requestApproval.status = RequestApprovalStatusTypesEnum.REQUESTED;
		requestApproval.approvalPolicyId = entity.approvalPolicyId;
		requestApproval.min_count = entity.min_count;
		requestApproval.tags = entity.tags;
		requestApproval.organizationId = entity.organizationId;
		requestApproval.tenantId = tenantId;

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

		if (entity.employeeApprovals) {
			const employees: IEmployee[] = await this.typeOrmEmployeeRepository.find({
				where: {
					id: In(entity.employeeApprovals)
				}
			});
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
			const teams: IOrganizationTeam[] = await this.typeOrmOrganizationTeamRepository.find({
				where: {
					id: In(entity.teams)
				}
			});
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
		return this.typeOrmRepository.save(requestApproval);
	}

	async updateStatusRequestApprovalByAdmin(id: string, status: number): Promise<RequestApproval> {
		const [requestApproval] = await this.typeOrmRepository.find({
			where: {
				id
			},
			relations: {
				approvalPolicy: true
			}
		});
		if (!requestApproval) {
			throw new NotFoundException('Request Approval not found');
		}
		// if (
		// 	requestApproval.status ===
		// 		RequestApprovalStatusTypesEnum.APPROVED ||
		// 	requestApproval.status ===
		// 		RequestApprovalStatusTypesEnum.REFUSED
		// ) {
		// 	throw new ConflictException('Request Approval is Conflict');
		// }

		requestApproval.status = status;

		return this.typeOrmRepository.save(requestApproval);
	}

	async updateStatusRequestApprovalByEmployeeOrTeam(id: string, status: number): Promise<RequestApproval> {
		let minCount = 0;
		const employeeId = RequestContext.currentUser().employeeId;
		const [requestApproval] = await this.typeOrmRepository.find({
			where: {
				id
			},
			relations: {
				employeeApprovals: true,
				teamApprovals: true
			}
		});

		if (!requestApproval) {
			throw new NotFoundException('Request Approval not found');
		}

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

		return this.typeOrmRepository.save(requestApproval);
	}
}
