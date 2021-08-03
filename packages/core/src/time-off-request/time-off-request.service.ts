import {
	Injectable,
	BadRequestException,
	NotFoundException,
	ConflictException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeOffRequest } from './time-off-request.entity';
import { TenantAwareCrudService } from './../core/crud';
import {
	ITimeOffCreateInput,
	RequestApprovalStatusTypesEnum,
	StatusTypesEnum,
	StatusTypesMapRequestApprovalEnum,
	ApprovalPolicyTypesStringEnum
} from '@gauzy/contracts';
import { RequestApproval } from '../request-approval/request-approval.entity';
import { RequestContext } from '../core/context';
import * as moment from 'moment';

@Injectable()
export class TimeOffRequestService extends TenantAwareCrudService<TimeOffRequest> {
	constructor(
		@InjectRepository(TimeOffRequest)
		private readonly timeOffRequestRepository: Repository<TimeOffRequest>,
		@InjectRepository(RequestApproval)
		private readonly requestApprovalRepository: Repository<RequestApproval>
	) {
		super(timeOffRequestRepository);
	}

	async create(entity: ITimeOffCreateInput): Promise<TimeOffRequest> {
		try {
			const request = new TimeOffRequest();
			Object.assign(request, entity);

			const timeOffRequestSaved = await this.timeOffRequestRepository.save(
				request
			);

			const requestApproval = new RequestApproval();
			requestApproval.requestId = timeOffRequestSaved.id;
			requestApproval.requestType =
				ApprovalPolicyTypesStringEnum.TIME_OFF;
			requestApproval.status = timeOffRequestSaved.status
				? StatusTypesMapRequestApprovalEnum[timeOffRequestSaved.status]
				: RequestApprovalStatusTypesEnum.REQUESTED;

			requestApproval.createdBy = RequestContext.currentUser().id;
			requestApproval.createdByName = RequestContext.currentUser().name;
			requestApproval.name = 'Request time off';
			requestApproval.min_count = 1;
			requestApproval.organizationId = timeOffRequestSaved.organizationId;
			requestApproval.tenantId = timeOffRequestSaved.tenantId;

			await this.requestApprovalRepository.save(requestApproval);
			return timeOffRequestSaved;
		} catch (err) {
			throw new BadRequestException(err);
		}
	}

	async getAllTimeOffRequests(relations, findInput?, filterDate?) {
		try {
			const tenantId = RequestContext.currentTenantId();
			const query = this.timeOffRequestRepository.createQueryBuilder(
				'timeoff'
			);
			query
				.leftJoinAndSelect(`${query.alias}.employees`, `employees`)
				.leftJoinAndSelect(`${query.alias}.policy`, `policy`)
				.leftJoinAndSelect(`employees.user`, `user`);
			query.where((qb) => {
				qb.andWhere(
					`"${query.alias}"."organizationId" = :organizationId`,
					{
						organizationId: findInput.organizationId
					}
				);
				qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, {
					tenantId
				});
			});
			if (findInput['employeeId']) {
				const employeeIds = [findInput['employeeId']];
				query.innerJoin(
					`${query.alias}.employees`,
					'employee',
					'employee.id IN (:...employeeIds)',
					{ employeeIds }
				);
			}
			if (filterDate) {
				const startDate = moment(filterDate)
					.startOf('month')
					.format('YYYY-MM-DD hh:mm:ss');
				const endDate = moment(filterDate)
					.endOf('month')
					.format('YYYY-MM-DD hh:mm:ss');
				query.andWhere(
					`"${query.alias}"."start" BETWEEN :begin AND :end`,
					{ begin: startDate, end: endDate }
				);
			}
			const items = await query.getMany();
			return { items, total: items.length };
		} catch (err) {
			throw new BadRequestException(err);
		}
	}

	async updateTimeOffByAdmin(
		id: string,
		timeOffRequest: ITimeOffCreateInput
	) {
		await this.timeOffRequestRepository.delete(id);
		return await this.timeOffRequestRepository.save(timeOffRequest);
	}

	async updateStatusTimeOffByAdmin(
		id: string,
		status: string
	): Promise<TimeOffRequest> {
		try {
			const timeOffRequest = await this.timeOffRequestRepository.findOne(
				id
			);

			if (!timeOffRequest) {
				throw new NotFoundException('Request time off not found');
			}
			if (timeOffRequest.status === StatusTypesEnum.REQUESTED) {
				timeOffRequest.status = status;
			} else {
				throw new ConflictException('Request time off is Conflict');
			}
			return await this.timeOffRequestRepository.save(timeOffRequest);
		} catch (err) {
			throw new BadRequestException(err);
		}
	}
}
