import {
	Injectable,
	BadRequestException,
	NotFoundException,
	ConflictException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, FindManyOptions, In, Repository } from 'typeorm';
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
import { getConfig } from '@gauzy/config';
import { RequestContext } from '../core/context';
import {
	Employee,
	OrganizationTeam,
	RequestApprovalEmployee,
	RequestApprovalTeam
} from './../core/entities/internal';
import { TenantAwareCrudService } from './../core/crud';
import { RequestApproval } from './request-approval.entity';

const config = getConfig();

@Injectable()
export class RequestApprovalService extends TenantAwareCrudService<RequestApproval> {
	constructor(
		@InjectRepository(RequestApproval)
		private readonly requestApprovalRepository: Repository<RequestApproval>,

		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,

		@InjectRepository(OrganizationTeam)
		private readonly organizationTeamRepository: Repository<OrganizationTeam>
	) {
		super(requestApprovalRepository);
	}

	async findAllRequestApprovals(
		filter: FindManyOptions<RequestApproval>,
		findInput: IRequestApprovalFindInput
	): Promise<IPagination<IRequestApproval>> {
		const query = this.requestApprovalRepository.createQueryBuilder('request_approval');
		query.leftJoinAndSelect(`${query.alias}.approvalPolicy`, 'approvalPolicy');

		if (config.dbConnectionOptions.type === 'sqlite') {
			query.leftJoinAndSelect(
				'time_off_request',
				'time_off_request',
				'"time_off_request"."id" = "request_approval"."requestId"'
			);
			query.leftJoinAndSelect(
				'equipment_sharing',
				'equipment_sharing',
				'"equipment_sharing"."id" = "request_approval"."requestId"'
			);
		} else {
			query.leftJoinAndSelect(
				'time_off_request',
				'time_off_request',
				'"time_off_request"."id"::"varchar" = "request_approval"."requestId"'
			);
			query.leftJoinAndSelect(
				'equipment_sharing',
				'equipment_sharing',
				'"equipment_sharing"."id"::"varchar" = "request_approval"."requestId"'
			);
		}

		const relations = filter.relations as string[];
		if (relations && relations.length > 0) {
			query.setFindOptions({ relations });
		}

		const tenantId = RequestContext.currentTenantId();
		const { organizationId } = findInput;

		const [items, total] = await query
			.where(
				new Brackets((sqb) => {
					sqb.where('approvalPolicy.organizationId =:organizationId', {
						organizationId
					}).andWhere('approvalPolicy.tenantId =:tenantId', {
						tenantId
					});
				})
			)
			.orWhere(
				new Brackets((sqb) => {
					sqb.where('time_off_request.organizationId =:organizationId', {
						organizationId
					})
					.andWhere('time_off_request.tenantId =:tenantId', {
						tenantId
					});
				})
			)
			.orWhere(
				new Brackets((sqb) => {
					sqb.where('equipment_sharing.organizationId =:organizationId', {
						organizationId
					}).andWhere('equipment_sharing.tenantId =:tenantId', {
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
		try {
			const tenantId = RequestContext.currentTenantId();
			const { organizationId } = findInput;
			const result = await this.requestApprovalRepository.find({
				where: {
					createdBy: id,
					organizationId,
					tenantId
				}
			});
			let requestApproval = [];
			const [employee] = await this.employeeRepository.find({
				where: {
					id
				},
				relations
			});
			if (
				employee &&
				employee.requestApprovals &&
				employee.requestApprovals.length > 0
			) {
				requestApproval = [
					...requestApproval,
					...employee.requestApprovals
				];
			}

			for (const request of requestApproval) {
				const approval = await this.requestApprovalRepository.findOne({
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
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	async createRequestApproval(
		entity: IRequestApprovalCreateInput
	): Promise<RequestApproval> {
		try {
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
				const employees: IEmployee[] = await this.employeeRepository.find({
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
				const teams: IOrganizationTeam[] = await this.organizationTeamRepository.find({
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
			return this.requestApprovalRepository.save(requestApproval);
		} catch (err) {
			throw new BadRequestException(err);
		}
	}
	async updateRequestApproval(
		id: string,
		entity: IRequestApprovalCreateInput
	): Promise<RequestApproval> {
		try {
			const tenantId = RequestContext.currentTenantId();
			const requestApproval = await this.requestApprovalRepository.findOneBy({
				id
			});
			requestApproval.name = entity.name;
			requestApproval.status = RequestApprovalStatusTypesEnum.REQUESTED;
			requestApproval.approvalPolicyId = entity.approvalPolicyId;
			requestApproval.min_count = entity.min_count;
			requestApproval.tags = entity.tags;
			requestApproval.organizationId = entity.organizationId;
			requestApproval.tenantId = tenantId;

			await this.repository
				.createQueryBuilder()
				.delete()
				.from(RequestApprovalEmployee)
				.where('requestApprovalId = :id', { id: id })
				.execute();

			await this.repository
				.createQueryBuilder()
				.delete()
				.from(RequestApprovalTeam)
				.where('requestApprovalId = :id', { id: id })
				.execute();

			if (entity.employeeApprovals) {
				const employees: IEmployee[] = await this.employeeRepository.find({
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
				const teams: IOrganizationTeam[] = await this.organizationTeamRepository.find({
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
			return this.requestApprovalRepository.save(requestApproval);
		} catch (err /*: WriteError*/) {
			throw new BadRequestException(err);
		}
	}

	async updateStatusRequestApprovalByAdmin(
		id: string,
		status: number
	): Promise<RequestApproval> {
		try {
			const [requestApproval] = await this.requestApprovalRepository.find({
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

			return this.requestApprovalRepository.save(requestApproval);
		} catch (err /*: WriteError*/) {
			throw err;
		}
	}

	async updateStatusRequestApprovalByEmployeeOrTeam(
		id: string,
		status: number
	): Promise<RequestApproval> {
		try {
			let minCount = 0;
			const employeeId = RequestContext.currentUser().employeeId;
			const [requestApproval] = await this.requestApprovalRepository.find({
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
				requestApproval.status ===
				RequestApprovalStatusTypesEnum.APPROVED ||
				requestApproval.status ===
				RequestApprovalStatusTypesEnum.REFUSED
			) {
				throw new ConflictException('Request Approval is Conflict');
			}

			if (
				requestApproval.employeeApprovals &&
				requestApproval.employeeApprovals.length > 0
			) {
				requestApproval.employeeApprovals.forEach((req) => {
					if (req.employeeId === employeeId) {
						req.status = status;
					}
					if (
						req.status === RequestApprovalStatusTypesEnum.APPROVED
					) {
						minCount++;
					}
				});
			}

			if (status === RequestApprovalStatusTypesEnum.REFUSED) {
				requestApproval.status = RequestApprovalStatusTypesEnum.REFUSED;
			} else if (minCount >= requestApproval.min_count) {
				requestApproval.status =
					RequestApprovalStatusTypesEnum.APPROVED;
			}

			return this.requestApprovalRepository.save(requestApproval);
		} catch (err /*: WriteError*/) {
			throw err;
		}
	}
}
