import {
	Injectable,
	BadRequestException,
	NotFoundException,
	ConflictException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Brackets, In, Repository, WhereExpressionBuilder } from 'typeorm';
import * as moment from 'moment';
import {
	ITimeOffCreateInput,
	RequestApprovalStatusTypesEnum,
	StatusTypesEnum,
	StatusTypesMapRequestApprovalEnum,
	ApprovalPolicyTypesStringEnum,
	IPagination,
	ITimeOffFindInput
} from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { TimeOffRequest } from './time-off-request.entity';
import { RequestApproval } from '../request-approval/request-approval.entity';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context';
import { getDateRangeFormat } from './../core/utils';

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

	async getAllTimeOffRequests(
		relations: string[], 
		findInput: ITimeOffFindInput
	): Promise<IPagination<TimeOffRequest>> {
		try {
			const { organizationId, employeeId, startDate, endDate } = findInput;
			const tenantId = RequestContext.currentTenantId();
			const query = this.timeOffRequestRepository.createQueryBuilder('timeoff');
			query
				.leftJoinAndSelect(`${query.alias}.employees`, `employees`)
				.leftJoinAndSelect(`${query.alias}.policy`, `policy`)
				.leftJoinAndSelect(`employees.user`, `user`);
			query
				.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => { 
						qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
						qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });
					})
				);
				
			if (employeeId) {
				const employeeIds = [employeeId];
				query.innerJoin(`${query.alias}.employees`, 'employee', 'employee.id IN (:...employeeIds)', {
					employeeIds
				});
			}
			const start = moment(startDate).format('YYYY-MM-DD hh:mm:ss');
			const end = moment(endDate).format('YYYY-MM-DD hh:mm:ss');

			query.andWhere(`"${query.alias}"."start" BETWEEN :begin AND :end`, {
				begin: start,
				end: end
			});
			
			console.log(query.getQueryAndParameters());
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

	public pagination(filter?: any) {		
		if ('where' in filter) {
			const { where } = filter;
			if (isNotEmpty(where.employeeIds)) {
				filter.where.employees = {
					id: In(where.employeeIds)
				}
			}
				delete filter['where']['employeeIds'];
			if (where.startDate && where.endDate) {
				const { start: startDate, end: endDate } = getDateRangeFormat(
					new Date(where.startDate),
					new Date(where.endDate),
					true
				);
				filter.where.start = Between(
					startDate,
					endDate
				);
				delete filter['where']['startDate'];
				delete filter['where']['endDate'];
			}
		}
		console.log({ filter });
		return super.paginate(filter);
	}
}
