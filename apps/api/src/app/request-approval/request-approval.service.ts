import { CrudService, IPagination } from '../core';
import { RequestApproval } from './request-approval.entity';
import {
	Injectable,
	BadRequestException,
	NotFoundException
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

@Injectable()
export class RequestApprovalService extends CrudService<RequestApproval> {
	constructor(
		@InjectRepository(RequestApproval)
		private readonly requestApprovalRepository: Repository<RequestApproval>,
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>
	) {
		super(requestApprovalRepository);
	}

	async findAllRequestApprovals(
		filter: FindManyOptions<RequestApproval>
	): Promise<IPagination<IRequestApproval>> {
		const total = await this.requestApprovalRepository.count(filter);

		const items = await this.requestApprovalRepository.find(filter);
		for (const rApproval of items) {
			if (
				rApproval &&
				rApproval.employeeApprovals &&
				rApproval.employeeApprovals.length > 0
			) {
				for (const empApproval of rApproval.employeeApprovals) {
					const emp = await this.employeeRepository.findOne(
						empApproval.employeeId
					);
					emp.user = await this.employeeRepository.findOne(
						emp.userId
					);
					empApproval.employee = emp;
				}
			}
		}

		return { items, total };
	}

	async findRequestApprovalsByEmployeeId(
		filter: FindManyOptions<Employee>
	): Promise<IPagination<IRequestApproval>> {
		const total = await this.employeeRepository.count(filter);

		const items = await this.employeeRepository.find(filter);

		for (const requests of items) {
			if (
				requests &&
				requests.requestApprovals &&
				requests.requestApprovals.length > 0
			) {
				for (const request of requests.requestApprovals) {
					const emp = await this.requestApprovalRepository.findOne(
						request.requestApprovalId,
						{
							relations: ['approvalPolicy']
						}
					);
					request.requestApproval = emp;
				}
			}
		}

		return { items, total };
	}

	async createRequestApproval(
		entity: IRequestApprovalCreateInput
	): Promise<RequestApproval> {
		try {
			const requestApproval = new RequestApproval();
			requestApproval.name = entity.name;
			requestApproval.status = RequestApprovalStatusTypesEnum.REQUESTED;
			requestApproval.approvalPolicyId = entity.approvalPolicyId;
			requestApproval.type = entity.type;
			requestApproval.min_count = entity.min_count;
			requestApproval.createdBy = RequestContext.currentUser().id;

			const employees = await this.employeeRepository.findByIds(
				entity.requestApprovalEmployees,
				{
					relations: ['user']
				}
			);

			const requestApprovalEmployees: RequestApprovalEmployee[] = [];
			employees.forEach((employee) => {
				const raEmployees = new RequestApprovalEmployee();
				raEmployees.employeeId = employee.id;
				raEmployees.employee = employee;
				raEmployees.status = RequestApprovalStatusTypesEnum.REQUESTED;
				requestApprovalEmployees.push(raEmployees);
			});

			requestApproval.employeeApprovals = requestApprovalEmployees;
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
			requestApproval.type = entity.type;
			const employees = await this.employeeRepository.findByIds(
				entity.requestApprovalEmployees,
				{
					relations: ['user']
				}
			);

			await this.repository
				.createQueryBuilder()
				.delete()
				.from(RequestApprovalEmployee)
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

			requestApproval.employeeApprovals = requestApprovalEmployees;
			return this.requestApprovalRepository.save(requestApproval);
		} catch (err /*: WriteError*/) {
			throw new BadRequestException(err);
		}
	}

	async updateStatusRequestApproval(
		id: string,
		status: number
	): Promise<RequestApproval> {
		try {
			let minCount = 0;
			const employeeId = RequestContext.currentUser().employeeId;
			const requestApproval = await this.requestApprovalRepository.findOne(
				id,
				{
					relations: ['employeeApprovals']
				}
			);

			if (!requestApproval) {
				throw new NotFoundException('Request Approval not found');
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
