import {
	Injectable,
	BadRequestException,
	NotFoundException,
	ConflictException
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeOffRequest } from './time-off-request.entity';
import { CrudService } from '../core/crud/crud.service';
import {
	ITimeOffCreateInput,
	RequestApprovalStatusTypesEnum,
	StatusTypesEnum,
	StatusTypesMapRequestApprovalEnum,
	ApprovalPolicyTypesStringEnum
} from '@gauzy/models';
import { RequestApproval } from '../request-approval/request-approval.entity';
import { RequestContext } from '../core/context';

@Injectable()
export class TimeOffRequestService extends CrudService<TimeOffRequest> {
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
			const where = {
				organizationId: findInput['organizationId'],
				tenantId: findInput['tenantId']
			};
			const allRequests = await this.timeOffRequestRepository.find({
				where,
				relations
			});

			let items = [];
			if (findInput['employeeId']) {
				allRequests.forEach((request) => {
					request.employees.forEach((e) => {
						if (e.id === findInput['employeeId']) {
							items.push(request);
						}
					});
					if (request.employees.length === 0) items.push(request);
				});
			} else {
				items = allRequests;
			}

			if (filterDate) {
				const dateObject = new Date(filterDate);

				const month = dateObject.getMonth() + 1;
				const year = dateObject.getFullYear();

				items = [...items].filter((i) => {
					const currentItemMonth = i.start.getMonth() + 1;
					const currentItemYear = i.start.getFullYear();
					return (
						currentItemMonth === month && currentItemYear === year
					);
				});
			}

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
