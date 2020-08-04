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
	TimeOffCreateInput as ITimeOffCreateInput,
	RequestApprovalStatusTypesEnum,
	StatusTypesEnum,
	StatusTypesMapRequestApprovalEnum,
	ApprovalPolicyTypesStringEnum
} from '@gauzy/models';
import { ApprovalPolicy } from '../approval-policy/approval-policy.entity';
import { RequestApproval } from '../request-approval/request-approval.entity';
import { RequestContext } from '../core/context';

@Injectable()
export class TimeOffRequestService extends CrudService<TimeOffRequest> {
	constructor(
		@InjectRepository(TimeOffRequest)
		private readonly timeOffRequestRepository: Repository<TimeOffRequest>,
		@InjectRepository(RequestApproval)
		private readonly requestApprovalRepository: Repository<RequestApproval>,
		@InjectRepository(ApprovalPolicy)
		private readonly approvalPolicyRepository: Repository<ApprovalPolicy>
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
			requestApproval.status = timeOffRequestSaved.status
				? StatusTypesMapRequestApprovalEnum[timeOffRequestSaved.status]
				: RequestApprovalStatusTypesEnum.REQUESTED;

			const approvalPolicy = await this.approvalPolicyRepository.findOne({
				where: {
					organizationId: timeOffRequestSaved.organizationId,
					approvalType: ApprovalPolicyTypesStringEnum.TIME_OFF
				}
			});

			if (approvalPolicy) {
				requestApproval.approvalPolicyId = approvalPolicy.id;
			}
			requestApproval.createdBy = RequestContext.currentUser().id;
			requestApproval.createdByName = RequestContext.currentUser().name;
			requestApproval.name = 'Request time off';
			requestApproval.min_count = 1;

			await this.requestApprovalRepository.save(requestApproval);
			return timeOffRequestSaved;
		} catch (err) {
			throw new BadRequestException(err);
		}
	}

	async getAllTimeOffRequests(relations, findInput?, filterDate?) {
		try {
			const allRequests = await this.timeOffRequestRepository.find({
				where: {
					organizationId: findInput['organizationId']
				},
				relations
			});
			let items = [];
			const total = await this.timeOffRequestRepository.count();

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

			return { items, total };
		} catch (err) {
			throw new BadRequestException(err);
		}
	}

	async updateStatusTimeOffByAdmin(
		id: string,
		status: string
	): Promise<TimeOffRequest> {
		try {
			const [timeOffRequest, requestApproval] = await Promise.all([
				await this.timeOffRequestRepository.findOne(id),
				await this.requestApprovalRepository.findOne({
					requestId: id
				})
			]);

			if (!timeOffRequest) {
				throw new NotFoundException('Request time off not found');
			}
			if (timeOffRequest.status === StatusTypesEnum.REQUESTED) {
				timeOffRequest.status = status;
				if (requestApproval) {
					requestApproval.status =
						StatusTypesMapRequestApprovalEnum[status];
					await this.requestApprovalRepository.save(requestApproval);
				}
			} else {
				throw new ConflictException('Request time off is Conflict');
			}
			return await this.timeOffRequestRepository.save(timeOffRequest);
		} catch (err) {
			throw new BadRequestException(err);
		}
	}
}
