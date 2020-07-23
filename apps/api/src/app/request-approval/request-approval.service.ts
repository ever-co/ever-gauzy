import { CrudService, IPagination } from '../core';
import { RequestApproval } from './request-approval.entity';
import {
	Injectable,
	BadRequestException,
	NotFoundException,
	ConflictException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';
import {
	RequestApproval as IRequestApproval,
	RequestApprovalStatusTypesEnum,
	RequestApprovalCreateInput as IRequestApprovalCreateInput
} from '@gauzy/models';
import { Employee } from '../employee/employee.entity';
import { RequestApprovalEmployee } from '../request-approval-employee/request-approval-employee.entity';
import { RequestContext } from '../core/context';
import { OrganizationTeam } from '../organization-team/organization-team.entity';
import { RequestApprovalTeam } from '../request-approval-team/request-approval-team.entity';
import { OrganizationTeamService } from '../organization-team/organization-team.service';

@Injectable()
export class RequestApprovalService extends CrudService<RequestApproval> {
	constructor(
		@InjectRepository(RequestApproval)
		private readonly requestApprovalRepository: Repository<RequestApproval>,
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,
		private readonly organizationTeamService: OrganizationTeamService,
		@InjectRepository(OrganizationTeam)
		private readonly organizationTeamRepository: Repository<
			OrganizationTeam
		>
	) {
		super(requestApprovalRepository);
	}

	async findAllRequestApprovals(
		filter: FindManyOptions<RequestApproval>,
		organizationId: string
	): Promise<IPagination<IRequestApproval>> {
		let requestApproval = this.requestApprovalRepository
			.createQueryBuilder('request_approval')
			.innerJoinAndSelect(
				'request_approval.approvalPolicy',
				'approvalPolicy'
			);

		if (filter.relations && filter.relations.length > 0) {
			filter.relations.forEach((item) => {
				requestApproval = requestApproval.leftJoinAndSelect(
					`request_approval.${item}`,
					item
				);
			});
		}

		const [items, total] = await requestApproval
			.where('approvalPolicy.organizationId =:organizationId', {
				organizationId
			})
			.getManyAndCount();

		return { items, total };
	}

	async findRequestApprovalsByEmployeeId(
		id: string,
		relations: string[]
	): Promise<IPagination<IRequestApproval>> {
		try {
			const result = await this.requestApprovalRepository.find({
				where: {
					createdBy: id
				}
			});

			const employeeTeam = await this.organizationTeamService.getMyOrgTeams(
				{
					relations: ['members']
				},
				id
			);

			let requestApproval = [];

			if (employeeTeam.items && employeeTeam.items.length > 0) {
				for (const team of employeeTeam.items) {
					const organizationTeam = await this.organizationTeamRepository.findOne(
						team.id,
						{
							relations: ['requestApprovals']
						}
					);
					requestApproval = [
						...requestApproval,
						...organizationTeam.requestApprovals
					];
				}
			}

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
							'teamApprovals'
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

			const employees = await this.employeeRepository.findByIds(
				entity.employeeApprovals,
				{
					relations: ['user']
				}
			);

			const teams = await this.organizationTeamRepository.findByIds(
				entity.teams
			);

			const requestApprovalEmployees: RequestApprovalEmployee[] = [];
			employees.forEach((employee) => {
				const raEmployees = new RequestApprovalEmployee();
				raEmployees.employeeId = employee.id;
				raEmployees.employee = employee;
				raEmployees.status = RequestApprovalStatusTypesEnum.REQUESTED;
				requestApprovalEmployees.push(raEmployees);
			});

			const requestApprovalTeams: RequestApprovalTeam[] = [];
			teams.forEach((team) => {
				const raTeam = new RequestApprovalTeam();
				raTeam.teamId = team.id;
				raTeam.team = team;
				raTeam.status = RequestApprovalStatusTypesEnum.REQUESTED;
				requestApprovalTeams.push(raTeam);
			});

			requestApproval.employeeApprovals = requestApprovalEmployees;
			requestApproval.teamApprovals = requestApprovalTeams;
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
			const requestApproval = await this.requestApprovalRepository.findOne(
				id
			);

			requestApproval.name = entity.name;
			requestApproval.status = RequestApprovalStatusTypesEnum.REQUESTED;
			requestApproval.approvalPolicyId = entity.approvalPolicyId;
			requestApproval.min_count = entity.min_count;
			const employees = await this.employeeRepository.findByIds(
				entity.employeeApprovals,
				{
					relations: ['user']
				}
			);

			const teams = await this.organizationTeamRepository.findByIds(
				entity.teams
			);

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

			const requestApprovalEmployees: RequestApprovalEmployee[] = [];
			employees.forEach((employee) => {
				const raEmployees = new RequestApprovalEmployee();
				raEmployees.employeeId = employee.id;
				raEmployees.employee = employee;
				raEmployees.status = RequestApprovalStatusTypesEnum.REQUESTED;
				requestApprovalEmployees.push(raEmployees);
			});

			const requestApprovalTeams: RequestApprovalTeam[] = [];
			teams.forEach((team) => {
				const raTeam = new RequestApprovalTeam();
				raTeam.teamId = team.id;
				raTeam.team = team;
				raTeam.status = RequestApprovalStatusTypesEnum.REQUESTED;
				requestApprovalTeams.push(raTeam);
			});

			requestApproval.employeeApprovals = requestApprovalEmployees;
			requestApproval.teamApprovals = requestApprovalTeams;
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
				id
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
