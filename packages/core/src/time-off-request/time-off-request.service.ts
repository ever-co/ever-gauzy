import {
	Injectable,
	BadRequestException,
	NotFoundException,
	ConflictException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Brackets, Like, Repository, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
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
			const timeOffRequest = await this.timeOffRequestRepository.findOneBy({
				id
			});

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

	/**
	 * Time Off Request override pagination method
	 *
	 * @param options
	 * @returns
	 */
	public async pagination(options: any) {
		try {
			const query = this.repository.createQueryBuilder(this.alias);
			// Set query options
			if (isNotEmpty(options)) {
				query.setFindOptions({
					skip: options.skip ? options.take * (options.skip - 1) : 0,
					take: options.take ? options.take : 10,

					...(options.join ? { join: options.join } : {}),
					...(options.relations ? { relations: options.relations } : {}),
				});
			}
			query.where((qb: SelectQueryBuilder<TimeOffRequest>) => {
				qb.andWhere(
					new Brackets((web: WhereExpressionBuilder) => {
						web.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, {
							tenantId: RequestContext.currentTenantId()
						});
						if (isNotEmpty(options.where)) {
							const { where } = options;
							if (isNotEmpty(where.organizationId)) {
								const { organizationId } = where;
								web.andWhere(`"${qb.alias}"."organizationId" = :organizationId`, {
									organizationId
								});
							}
						}
					})
				);
				if (isNotEmpty(options.where)) {
					const { where } = options;
					if (isNotEmpty(where.employeeIds)) {
						const { employeeIds } = where;
						qb.andWhere(`"employees"."id" IN (:...employeeIds)`, {
							employeeIds
						});
					}
					/**
					 * Filter by dates or current month
					 */
					let startDate = moment().startOf('month').utc().format('YYYY-MM-DD HH:mm:ss');
					let endDate = moment().endOf('month').utc().format('YYYY-MM-DD HH:mm:ss');
					if (isNotEmpty(where.startDate) && isNotEmpty(where.endDate)) {
						startDate = moment.utc(where.startDate).format('YYYY-MM-DD HH:mm:ss');
						endDate = moment.utc(where.endDate).format('YYYY-MM-DD HH:mm:ss');
					}
					qb.andWhere(
						new Brackets((web: WhereExpressionBuilder) => {
							web.where(
								[
									{
										start: Between(startDate, endDate)
									},
									{
										end: Between(startDate, endDate)
									}
								]
							);
						})
					);
					if (
						isNotEmpty(where.isHoliday) &&
						isNotEmpty(Boolean(JSON.parse(where.isHoliday)))
					) {
						qb.andWhere({ isHoliday: false });
					}
					if (isNotEmpty(where.includeArchived)) {
						qb.andWhere({
							isArchived: Boolean(JSON.parse(where.includeArchived))
						});
					}
					if (isNotEmpty(where.status)) {
						qb.andWhere({
							status: where.status
						});
					}
					qb.andWhere(
						new Brackets((web: WhereExpressionBuilder) => {
							if (isNotEmpty(where.user) && isNotEmpty(where.user.name)) {
								const keywords: string[] = where.user.name.split(' ');
								keywords.forEach((keyword: string, index: number) => {
									web.orWhere(`LOWER("user"."firstName") like LOWER(:keyword_${index})`, {
										[`keyword_${index}`]: `%${keyword}%`
									});
									web.orWhere(`LOWER("user"."lastName") like LOWER(:${index}_keyword)`, {
										[`${index}_keyword`]: `%${keyword}%`
									});
								});
							}
						})
					);
					qb.andWhere(
						new Brackets((web: WhereExpressionBuilder) => {
							if (isNotEmpty(where.description)) {
								const { description } = where;
								web.andWhere({
									description: Like(`%${description}%`)
								});
							}
							if (isNotEmpty(where.policy) && isNotEmpty(where.policy.name)) {
								web.andWhere({
									policy: {
										name: Like(`%${where.policy.name}%`)
									}
								});
								web.andWhere(`LOWER("policy"."name") like LOWER(:name)`, {
									name: `%${where.policy.name}%`
								});
							}
						})
					);
				}
			});
			const [items, total] = await query.getManyAndCount();
			return { items, total };
		} catch (error) {
			console.log(error);
			throw new BadRequestException(error);
		}
	}
}
