import { TenantAwareCrudService } from './../core/crud';
import { RequestApproval } from './request-approval.entity';
import {
	Injectable,
	BadRequestException,
	NotFoundException,
	ConflictException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, FindManyOptions, Repository } from 'typeorm';
import {
	IRequestApproval,
	RequestApprovalStatusTypesEnum,
	IRequestApprovalCreateInput,
	IRequestApprovalFindInput,
	IPagination
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { Employee, OrganizationTeam, RequestApprovalEmployee, RequestApprovalTeam } from './../core/entities/internal';
import { getConfig } from '@gauzy/config';
const config = getConfig();

@Injectable()
export class RequestApprovalService extends TenantAwareCrudService<RequestApproval> {
	constructor(
		@InjectRepository(RequestApproval)
		private readonly requestApprovalRepository: Repository<RequestApproval>,
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,
		// private readonly organizationTeamService: OrganizationTeamService,
		@InjectRepository(OrganizationTeam)
		private readonly organizationTeamRepository: Repository<OrganizationTeam>
	) {
		super(requestApprovalRepository);
	}

	async findAllRequestApprovals(
		filter: FindManyOptions<RequestApproval>,
		findInput: IRequestApprovalFindInput
	): Promise<IPagination<IRequestApproval>> {
		const query = this.requestApprovalRepository.createQueryBuilder(
			'request_approval'
		);
		query.leftJoinAndSelect(
			`${query.alias}.approvalPolicy`,
			'approvalPolicy'
		);

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

		if (filter.relations && filter.relations.length > 0) {
			filter.relations.forEach((item) => {
				query.leftJoinAndSelect(`request_approval.${item}`, item);
			});
		}

		const { organizationId, tenantId } = findInput;
		const [items, total] = await query
			.where(
				new Brackets((sqb) => {
					sqb.where(
						'approvalPolicy.organizationId =:organizationId',
						{
							organizationId
						}
					).andWhere('approvalPolicy.tenantId =:tenantId', {
						tenantId
					});
				})
			)
			.orWhere(
				new Brackets((sqb) => {
					sqb.where(
						'time_off_request.organizationId =:organizationId',
						{
							organizationId
						}
					).andWhere('time_off_request.tenantId =:tenantId', {
						tenantId
					});
				})
			)
			.orWhere(
				new Brackets((sqb) => {
					sqb.where(
						'equipment_sharing.organizationId =:organizationId',
						{
							organizationId
						}
					).andWhere('equipment_sharing.tenantId =:tenantId', {
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
			const { organizationId, tenantId } = findInput;
			const result = await this.requestApprovalRepository.find({
				where: {
					createdBy: id,
					organizationId,
					tenantId
				}
			});

			// const employeeTeam = await this.organizationTeamService.getMyOrgTeams(
			// 	{
			// 		relations: ['members']
			// 	},
			// 	id
			// );

			let requestApproval = [];

			// if (employeeTeam.items && employeeTeam.items.length > 0) {
			// 	for (const team of employeeTeam.items) {
			// 		const organizationTeam = await this.organizationTeamRepository.findOne(
			// 			team.id,
			// 			{
			// 				relations: ['requestApprovals']
			// 			}
			// 		);
			// 		requestApproval = [
			// 			...requestApproval,
			// 			...organizationTeam.requestApprovals
			// 		];
			// 	}
			// }

			const employee = await this.employeeRepository.findOne(id, {
				relations
			});

			if (
				employee &&
				employee.requestApprovals &&
				employee.requestApprovals.length > 0
			) {
				// requestApproval.concat(employee.requestApprovals);
				requestApproval = [
					...requestApproval,
					...employee.requestApprovals
				];
			}

			for (const request of requestApproval) {
				const emp = await this.requestApprovalRepository.findOne(
					request.requestApprovalId,
					{
						relations: [
							'approvalPolicy',
							'employeeApprovals',
							'teamApprovals',
							'tags'
						]
					}
				);
				result.push(emp);
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
			const requestApproval = new RequestApproval();
			requestApproval.status = RequestApprovalStatusTypesEnum.REQUESTED;
			requestApproval.approvalPolicyId = entity.approvalPolicyId;
			requestApproval.createdBy = RequestContext.currentUser().id;
			requestApproval.createdByName = RequestContext.currentUser().name;
			requestApproval.name = entity.name;
			requestApproval.min_count = entity.min_count;
			requestApproval.tags = entity.tags;
			requestApproval.organizationId = entity.organizationId;
			requestApproval.tenantId = entity.tenantId;
			if (entity.employeeApprovals) {
				const employees = await this.employeeRepository.findByIds(
					entity.employeeApprovals,
					{
						relations: ['user']
					}
				);

				const requestApprovalEmployees: RequestApprovalEmployee[] = [];
				employees.forEach((employee) => {
					const raEmployees = new RequestApprovalEmployee();
					raEmployees.employeeId = employee.id;
					raEmployees.employee = employee;
					raEmployees.organizationId = entity.organizationId;
					raEmployees.tenantId = entity.tenantId;
					raEmployees.status =
						RequestApprovalStatusTypesEnum.REQUESTED;
					requestApprovalEmployees.push(raEmployees);
				});

				requestApproval.employeeApprovals = requestApprovalEmployees;
			}

			if (entity.teams) {
				const teams = await this.organizationTeamRepository.findByIds(
					entity.teams
				);

				const requestApprovalTeams: RequestApprovalTeam[] = [];
				teams.forEach((team) => {
					const raTeam = new RequestApprovalTeam();
					raTeam.teamId = team.id;
					raTeam.team = team;
					raTeam.status = RequestApprovalStatusTypesEnum.REQUESTED;
					raTeam.organizationId = entity.organizationId;
					raTeam.tenantId = entity.tenantId;
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
			let employees;
			let teams;
			const requestApproval = await this.requestApprovalRepository.findOne(
				id
			);

			requestApproval.name = entity.name;
			requestApproval.status = RequestApprovalStatusTypesEnum.REQUESTED;
			requestApproval.approvalPolicyId = entity.approvalPolicyId;
			requestApproval.min_count = entity.min_count;
			requestApproval.tags = entity.tags;
			requestApproval.organizationId = entity.organizationId;
			requestApproval.tenantId = entity.tenantId;

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
				employees = await this.employeeRepository.findByIds(
					entity.employeeApprovals,
					{
						relations: ['user']
					}
				);

				const requestApprovalEmployees: RequestApprovalEmployee[] = [];
				employees.forEach((employee) => {
					const raEmployees = new RequestApprovalEmployee();
					raEmployees.employeeId = employee.id;
					raEmployees.employee = employee;
					raEmployees.organizationId = entity.organizationId;
					raEmployees.tenantId = entity.tenantId;
					raEmployees.status =
						RequestApprovalStatusTypesEnum.REQUESTED;
					requestApprovalEmployees.push(raEmployees);
				});

				requestApproval.employeeApprovals = requestApprovalEmployees;
			}

			if (entity.teams) {
				teams = await this.organizationTeamRepository.findByIds(
					entity.teams
				);

				const requestApprovalTeams: RequestApprovalTeam[] = [];
				teams.forEach((team) => {
					const raTeam = new RequestApprovalTeam();
					raTeam.teamId = team.id;
					raTeam.team = team;
					raTeam.status = RequestApprovalStatusTypesEnum.REQUESTED;
					raTeam.organizationId = entity.organizationId;
					raTeam.tenantId = entity.tenantId;
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
			const requestApproval = await this.requestApprovalRepository.findOne(
				id,
				{
					relations: ['approvalPolicy']
				}
			);

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
			const requestApproval = await this.requestApprovalRepository.findOne(
				id,
				{
					relations: ['employeeApprovals', 'teamApprovals']
				}
			);

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
