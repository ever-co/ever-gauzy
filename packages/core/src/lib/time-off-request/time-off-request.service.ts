import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { Between, Brackets, Like, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
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
import { isNotEmpty } from '@gauzy/utils';
import { TimeOffRequest } from './time-off-request.entity';
import { RequestApproval } from '../request-approval/request-approval.entity';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context';
import { MultiORMEnum } from '../core/utils';
import { prepareSQLQuery as p } from './../database/database.helper';
import { TypeOrmRequestApprovalRepository } from '../request-approval/repository/type-orm-request-approval.repository';
import { MikroOrmTimeOffRequestRepository } from './repository/mikro-orm-time-off-request.repository';
import { TypeOrmTimeOffRequestRepository } from './repository/type-orm-time-off-request.repository';

@Injectable()
export class TimeOffRequestService extends TenantAwareCrudService<TimeOffRequest> {
	constructor(
		readonly typeOrmTimeOffRequestRepository: TypeOrmTimeOffRequestRepository,
		readonly mikroOrmTimeOffRequestRepository: MikroOrmTimeOffRequestRepository,
		readonly typeOrmRequestApprovalRepository: TypeOrmRequestApprovalRepository
	) {
		super(typeOrmTimeOffRequestRepository, mikroOrmTimeOffRequestRepository);
	}

	/**
	 * Creates a new time off request and its associated approval record.
	 *
	 * @param entity - The input data for creating a time off request.
	 * @returns A promise that resolves to the saved TimeOffRequest.
	 * @throws {BadRequestException} If any error occurs during the creation process.
	 */
	async create(entity: ITimeOffCreateInput): Promise<TimeOffRequest> {
		const request = new TimeOffRequest();
		Object.assign(request, entity);

		// Retrieve tenantId from RequestContext or options.
		const tenantId = RequestContext.currentTenantId() ?? entity.tenantId;

		// Save the time off request first.
		const timeOffRequest = await this.save(request);

		// Prepare the request approval record using the new request's id.
		const requestApproval = new RequestApproval();
		requestApproval.requestId = timeOffRequest.id;
		requestApproval.requestType = ApprovalPolicyTypesStringEnum.TIME_OFF;
		requestApproval.status = timeOffRequest.status
			? StatusTypesMapRequestApprovalEnum[timeOffRequest.status]
			: RequestApprovalStatusTypesEnum.REQUESTED;
		requestApproval.name = 'Request time off';
		requestApproval.min_count = 1;
		requestApproval.organizationId = timeOffRequest.organizationId;
		requestApproval.tenantId = tenantId;

		// Save the request approval record. Using Promise.all here allows you to
		// concurrently run other independent asynchronous operations if needed.
		await this.typeOrmRequestApprovalRepository.save(requestApproval);

		return timeOffRequest;
	}

	async getAllTimeOffRequests(
		relations: string[],
		findInput: ITimeOffFindInput
	): Promise<IPagination<TimeOffRequest>> {
		try {
			const { organizationId, employeeId, startDate, endDate } = findInput;
			const tenantId = RequestContext.currentTenantId();

			const start = moment(startDate).format('YYYY-MM-DD hh:mm:ss');
			const end = moment(endDate).format('YYYY-MM-DD hh:mm:ss');

			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					const where: any = {
						tenantId,
						organizationId,
						start: { $gte: start, $lte: end }
					};
					if (employeeId) {
						where.employees = { id: employeeId };
					}

					const items = await this.mikroOrmRepository.find(where, {
						populate: ['employees', 'policy', 'employees.user'] as any[]
					});
					return { items: items.map((e) => this.serialize(e)) as TimeOffRequest[], total: items.length };
				}
				case MultiORMEnum.TypeORM:
				default: {
					const query = this.typeOrmRepository.createQueryBuilder('timeoff');
					query
						.leftJoinAndSelect(`${query.alias}.employees`, `employees`)
						.leftJoinAndSelect(`${query.alias}.policy`, `policy`)
						.leftJoinAndSelect(`employees.user`, `user`);
					query.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
							qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
						})
					);

					if (employeeId) {
						const employeeIds = [employeeId];
						query.innerJoin(`${query.alias}.employees`, 'employee', 'employee.id IN (:...employeeIds)', {
							employeeIds
						});
					}

					query.andWhere(p(`"${query.alias}"."start" BETWEEN :begin AND :end`), {
						begin: start,
						end: end
					});
					const items = await query.getMany();
					return { items, total: items.length };
				}
			}
		} catch (err) {
			throw new BadRequestException(err);
		}
	}

	async updateTimeOffByAdmin(id: string, timeOffRequest: ITimeOffCreateInput) {
		try {
			// Verify the record belongs to the current tenant before updating
			await this.findOneByIdString(id);
			return await this.save({
				id,
				...timeOffRequest
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	async updateStatusTimeOffByAdmin(id: string, status: string): Promise<TimeOffRequest> {
		try {
			// Use tenant-scoped lookup instead of direct repository access
			const timeOffRequest = await this.findOneByIdString(id);

			if (timeOffRequest.status === StatusTypesEnum.REQUESTED) {
				timeOffRequest.status = status;
			} else {
				throw new ConflictException('Request time off is Conflict');
			}
			return await this.save(timeOffRequest);
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
			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					const tenantId = RequestContext.currentTenantId();
					const where: any = { tenantId };

					if (isNotEmpty(options?.where)) {
						const { organizationId, employeeIds, isHoliday, includeArchived, status, startDate, endDate } =
							options.where;
						if (isNotEmpty(organizationId)) where.organizationId = organizationId;
						if (isNotEmpty(employeeIds)) where.employees = { id: { $in: employeeIds } };
						if (isNotEmpty(status)) where.status = status;
						if (isNotEmpty(isHoliday) && isNotEmpty(Boolean(JSON.parse(isHoliday))))
							where.isHoliday = false;
						if (isNotEmpty(includeArchived)) where.isArchived = Boolean(JSON.parse(includeArchived));

						let sd = moment().startOf('month').utc().format('YYYY-MM-DD HH:mm:ss');
						let ed = moment().endOf('month').utc().format('YYYY-MM-DD HH:mm:ss');
						if (isNotEmpty(startDate) && isNotEmpty(endDate)) {
							sd = moment.utc(startDate).format('YYYY-MM-DD HH:mm:ss');
							ed = moment.utc(endDate).format('YYYY-MM-DD HH:mm:ss');
						}
						where.$or = [{ start: { $gte: sd, $lte: ed } }, { end: { $gte: sd, $lte: ed } }];

						// Text search filters matching TypeORM branch
						if (isNotEmpty(where.user) && isNotEmpty(where.user.name)) {
							const keywords: string[] = where.user.name.split(' ');
							const userFilters: any[] = [];
							keywords.forEach((keyword: string) => {
								userFilters.push({ employees: { user: { firstName: { $ilike: `%${keyword}%` } } } });
								userFilters.push({ employees: { user: { lastName: { $ilike: `%${keyword}%` } } } });
							});
							if (where.$or) {
								where.$and = [{ $or: where.$or }, { $or: userFilters }];
								delete where.$or;
							} else {
								where.$or = userFilters;
							}
						}
						if (isNotEmpty(where.description)) {
							where.description = { $ilike: `%${where.description}%` };
						}
						if (isNotEmpty(where.policy) && isNotEmpty(where.policy.name)) {
							where.policy = { name: { $ilike: `%${where.policy.name}%` } };
						}
					}

					const [items, total] = await this.mikroOrmRepository.findAndCount(where, {
						populate: (options.relations || []) as any[],
						limit: options.take ? options.take : 10,
						offset: options.skip ? (options.take || 10) * (options.skip - 1) : 0
					});
					return { items: items.map((e) => this.serialize(e)) as TimeOffRequest[], total };
				}
				case MultiORMEnum.TypeORM:
				default: {
					const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
					// Set query options
					if (isNotEmpty(options)) {
						query.setFindOptions({
							skip: options.skip ? options.take * (options.skip - 1) : 0,
							take: options.take ? options.take : 10,

							...(options.join ? { join: options.join } : {}),
							...(options.relations ? { relations: options.relations } : {})
						});
					}
					query.where((qb: SelectQueryBuilder<TimeOffRequest>) => {
						qb.andWhere(
							new Brackets((web: WhereExpressionBuilder) => {
								web.andWhere(p(`"${qb.alias}"."tenantId" = :tenantId`), {
									tenantId: RequestContext.currentTenantId()
								});
								if (isNotEmpty(options.where)) {
									const { where } = options;
									if (isNotEmpty(where.organizationId)) {
										const { organizationId } = where;
										web.andWhere(p(`"${qb.alias}"."organizationId" = :organizationId`), {
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
								qb.andWhere(p(`"employees"."id" IN (:...employeeIds)`), {
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
									web.where([
										{
											start: Between(startDate, endDate)
										},
										{
											end: Between(startDate, endDate)
										}
									]);
								})
							);
							if (isNotEmpty(where.isHoliday) && isNotEmpty(Boolean(JSON.parse(where.isHoliday)))) {
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
											web.orWhere(p(`LOWER("user"."firstName") like LOWER(:keyword_${index})`), {
												[`keyword_${index}`]: `%${keyword}%`
											});
											web.orWhere(p(`LOWER("user"."lastName") like LOWER(:${index}_keyword)`), {
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
										web.andWhere(p(`LOWER("policy"."name") like LOWER(:name)`), {
											name: `%${where.policy.name}%`
										});
									}
								})
							);
						}
					});
					const [items, total] = await query.getManyAndCount();
					return { items, total };
				}
			}
		} catch (error) {
			console.log(error);
			throw new BadRequestException(error);
		}
	}
}
