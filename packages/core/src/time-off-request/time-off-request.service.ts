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

			const tenantId = RequestContext.currentTenantId();
			const currentUser = RequestContext.currentUser();

			const timeOffRequest = await this.timeOffRequestRepository.save(request);

			const requestApproval = new RequestApproval();
			requestApproval.requestId = timeOffRequest.id;
			requestApproval.requestType = ApprovalPolicyTypesStringEnum.TIME_OFF;
			requestApproval.status = timeOffRequest.status
				? StatusTypesMapRequestApprovalEnum[timeOffRequest.status]
				: RequestApprovalStatusTypesEnum.REQUESTED;

			requestApproval.createdBy = currentUser.id;
			requestApproval.createdByName = currentUser.name;
			requestApproval.name = 'Request time off';
			requestApproval.min_count = 1;
			requestApproval.organizationId = timeOffRequest.organizationId;
			requestApproval.tenantId = tenantId;

			await this.requestApprovalRepository.save(requestApproval);
			return timeOffRequest;
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
		try {
			return await this.timeOffRequestRepository.save({
				id,
				...timeOffRequest
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
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
				delete filter['where']['employeeIds'];
			}
			if (where.startDate && where.endDate) {
				filter.where.start = Between(
					moment.utc(where.startDate).format('YYYY-MM-DD HH:mm:ss'),
					moment.utc(where.endDate).format('YYYY-MM-DD HH:mm:ss')
				);
				delete filter['where']['startDate'];
				delete filter['where']['endDate'];
			} else {
				filter.where.start = Between(
					moment().startOf('month').utc().format('YYYY-MM-DD HH:mm:ss'),
					moment().endOf('month').utc().format('YYYY-MM-DD HH:mm:ss')
				);
			}
		}
		return super.paginate(filter);
	}
}
