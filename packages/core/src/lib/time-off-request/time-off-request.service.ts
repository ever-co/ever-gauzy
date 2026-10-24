import { Injectable, BadRequestException, ConflictException, ForbiddenException, HttpException } from '@nestjs/common';
import { Brackets, LessThanOrEqual, Like, MoreThanOrEqual, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import * as moment from 'moment';
import {
	ITimeOffCreateInput,
	RequestApprovalStatusTypesEnum,
	StatusTypesEnum,
	StatusTypesMapRequestApprovalEnum,
	ApprovalPolicyTypesStringEnum,
	IPagination,
	ITimeOffFindInput,
	ID,
	PermissionsEnum,
	RolesEnum
} from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/utils';
import { TimeOffRequest } from './time-off-request.entity';
import { RequestApproval } from '../request-approval/request-approval.entity';
import { TimeOffPolicy } from '../core/entities/internal';
import {
	filedTimeOffStatus,
	ITimeOffWriteBody,
	requestedPolicyId,
	TIME_OFF_FOR_OTHERS_PERMISSIONS,
	timeOffEmployees,
	writableTimeOffMembers
} from './time-off-request-input.helper';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context';
import {
	mikroOrmContains,
	MultiORMEnum,
	parseFindOptionsRelations,
	parseSortOrder,
	splitKeywords
} from '../core/utils';
import { prepareSQLQuery as p } from './../database/database.helper';
import { assertCurrentUserBelongsToSentOrganization } from '../user-organization/assert-organization-membership';
import { TypeOrmRequestApprovalRepository } from '../request-approval/repository/type-orm-request-approval.repository';
import { MikroOrmTimeOffRequestRepository } from './repository/mikro-orm-time-off-request.repository';
import { TypeOrmTimeOffRequestRepository } from './repository/type-orm-time-off-request.repository';

/**
 * Columns the time off table can be sorted by. Any other `order` key from the query string is ignored.
 */
const SORTABLE_COLUMNS = ['start', 'end', 'requestDate'] as const;

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
	 * The row is written from the members a request may state (see `time-off-request-input.helper.ts`), never from
	 * the body as a whole: the body's `status` is ignored — the request is `REQUESTED`, or `APPROVED` when its stored
	 * policy requires no approval — and a caller who may not act for other employees files for themselves.
	 *
	 * @param entity - The input data for creating a time off request.
	 * @returns A promise that resolves to the saved TimeOffRequest.
	 * @throws {ForbiddenException} When a caller who may not act for others has no employee record.
	 * @throws {BadRequestException} If any error occurs during the creation process.
	 */
	async create(entity: ITimeOffCreateInput): Promise<TimeOffRequest> {
		const body = entity as unknown as ITimeOffWriteBody;

		// Retrieve tenantId from RequestContext or options.
		const tenantId = RequestContext.currentTenantId() ?? entity?.tenantId;

		const members = writableTimeOffMembers(body, { create: true });
		const employees = timeOffEmployees(body?.employees, this.timeOffCaller(), { create: true });
		const requiresApproval = await this.policyRequiresApproval(
			requestedPolicyId(body),
			tenantId,
			members.organizationId ?? RequestContext.currentOrganizationId()
		);

		const request = new TimeOffRequest();
		Object.assign(request, members, { employees, status: filedTimeOffStatus(requiresApproval) });

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

	/**
	 * Refuses a `GET /time-off-request` list scoped to an organization the current user is not a member of.
	 *
	 * The route reads its filter from a `?data=` JSON parameter that no DTO validates, and
	 * `getAllTimeOffRequests` filters on the organization it is given. Without one, the list matches nothing.
	 *
	 * @param organizationId the organization the request names
	 */
	async assertOrganizationMember(organizationId: unknown): Promise<void> {
		await assertCurrentUserBelongsToSentOrganization(this.typeOrmRepository.manager, organizationId);
	}

	async getAllTimeOffRequests(
		relations: string[],
		findInput: ITimeOffFindInput
	): Promise<IPagination<TimeOffRequest>> {
		try {
			const { organizationId, employeeId, startDate, endDate } = findInput;
			const tenantId = RequestContext.currentTenantId();

			// Both dates are optional, and the appointment calendar and the availability slots send none:
			// `moment(undefined)` is "now", so the window collapsed to a single instant and no time off was
			// ever listed. The format also used `hh`, the 12-hour clock without AM / PM, which moved an
			// afternoon bound 12 hours back. Same bounds as `pagination()` now, and only when both are given.
			// A plain presence check: `isNotEmpty` treats a Date (no enumerable property) as empty
			const isGiven = (value: unknown) => value !== undefined && value !== null && value !== '';
			const hasRange = isGiven(startDate) && isGiven(endDate);
			const start = hasRange ? moment.utc(startDate).format('YYYY-MM-DD HH:mm:ss') : undefined;
			const end = hasRange ? moment.utc(endDate).format('YYYY-MM-DD HH:mm:ss') : undefined;

			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					const where: any = {
						tenantId,
						organizationId,
						// Every time off overlapping the window, including one starting before it
						...(hasRange ? { start: { $lte: end }, end: { $gte: start } } : {})
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

					if (hasRange) {
						// Every time off overlapping the window: one starting before it (a leave from the 28th of
						// the previous month) was left out when only its start was checked
						query.andWhere(p(`"${query.alias}"."start" <= :end AND "${query.alias}"."end" >= :begin`), {
							begin: start,
							end: end
						});
					}
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
			// Verify the record belongs to the current tenant before updating, and make the verified id
			// the one that is saved: the body is not DTO-validated, so a body id spread after the path id
			// used to re-point the save (TypeORM save() with an existing PK is an UPDATE of that row).
			//
			// `findOneByIdString` THROWS NotFoundException when nothing matches the tenant-scoped
			// conditions, so this call is the check — an id belonging to another tenant, or to no row
			// at all, never reaches `save()` (where it would INSERT under the caller's tenant).
			const stored = await this.findOneByIdString(id, { relations: { policy: true } });

			// Only the members an edit may change are written (see `time-off-request-input.helper.ts`): never the
			// status — approving or denying is the approve / deny routes' decision — and the employees only for a
			// caller who may act for other employees.
			const body = timeOffRequest as unknown as ITimeOffWriteBody;
			const members = writableTimeOffMembers(body, { create: false });
			const employees = timeOffEmployees(body?.employees, this.timeOffCaller(), { create: false });

			await this.assertPolicyChangeKeepsDecision(stored, members.policy?.id);

			return await this.save({
				...members,
				...(employees ? { employees } : {}),
				id
			} as unknown as TimeOffRequest);
		} catch (error) {
			// Preserve intentional HTTP exceptions (the 404 above, and the ForbiddenException that
			// `save()` raises for a cross-tenant row) instead of flattening them to 400.
			if (error instanceof HttpException) {
				throw error;
			}
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
			// Preserve intentional HTTP exceptions (the 404 for an unknown id, the 409 above) instead of
			// flattening them to 400.
			if (err instanceof HttpException) {
				throw err;
			}
			throw new BadRequestException(err);
		}
	}

	/**
	 * Refuses an edit that moves an approved request onto a policy that requires approval, unless the caller may
	 * approve time off through the approve route (`SUPER_ADMIN` / `ADMIN` with `ALL_ORG_EDIT` or `TIME_OFF_EDIT`).
	 *
	 * An edit keeps the stored status, and a request filed under a policy that requires no approval is approved as
	 * it is filed. Moving it onto a policy that requires approval would keep an approval nobody gave. An edit that
	 * keeps the stored policy (the request dialog sends it every time) or names one that needs no approval passes.
	 *
	 * @param stored The stored request, read with its policy.
	 * @param policyId The policy the edit names, if any.
	 * @throws ForbiddenException when the edit would keep an approval the new policy requires someone to give.
	 */
	private async assertPolicyChangeKeepsDecision(stored: TimeOffRequest, policyId: ID | undefined): Promise<void> {
		if (!policyId || stored?.status !== StatusTypesEnum.APPROVED) {
			return;
		}
		if (policyId === (stored.policy?.id ?? stored.policyId)) {
			return;
		}
		if (
			RequestContext.hasRoles([RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN]) &&
			RequestContext.hasAnyPermission([PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_EDIT])
		) {
			return;
		}
		const requiresApproval = await this.policyRequiresApproval(
			policyId,
			RequestContext.currentTenantId(),
			stored.organizationId
		);
		if (requiresApproval === false) {
			return;
		}
		throw new ForbiddenException(
			'An approved time-off request cannot be moved onto a policy that requires approval. File a new request.'
		);
	}

	/**
	 * The caller, as far as choosing a time-off request's employees goes.
	 */
	private timeOffCaller(): { mayActForOthers: boolean; ownEmployeeId: ID | null } {
		return {
			mayActForOthers: RequestContext.hasAnyPermission([...TIME_OFF_FOR_OTHERS_PERMISSIONS]),
			ownEmployeeId: RequestContext.currentUser()?.employeeId ?? null
		};
	}

	/**
	 * Whether the policy a new request names requires approval, read from the store inside the request's tenant
	 * and organization — never from the body, which is what the browser's own status choice was read from.
	 *
	 * @param policyId The policy the body names.
	 * @param tenantId The caller's tenant.
	 * @param organizationId The request's organization.
	 * @returns The stored `requiresApproval`, or undefined when no such policy is in scope.
	 */
	private async policyRequiresApproval(
		policyId: ID | undefined,
		tenantId: ID | null | undefined,
		organizationId: ID | null | undefined
	): Promise<boolean | undefined> {
		if (!policyId || !tenantId || !organizationId) {
			return undefined;
		}
		const policy = await this.typeOrmRepository.manager.findOneBy(TimeOffPolicy, {
			id: policyId,
			tenantId,
			organizationId
		});
		return policy?.requiresApproval;
	}

	/**
	 * Time Off Request override pagination method
	 *
	 * @param options
	 * @returns
	 */
	public async pagination(options: any) {
		// Builds its own query, so the check in the CRUD read methods never runs: assert the
		// sensitive-relation table on the client-supplied relations before anything is loaded.
		this.assertRelationsPermitted(options);

		const order = parseSortOrder(options?.order, SORTABLE_COLUMNS);
		const hasOrder = Object.keys(order).length > 0;

		// "Include Archived" unchecked hides archived requests; checked (or not sent) adds no filter.
		// The query DTO JSON-parses `where` values, so the flag arrives as a boolean (or a string when called directly).
		const hideArchived = [false, 'false'].includes(options?.where?.includeArchived);

		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					const tenantId = RequestContext.currentTenantId();
					const where: any = { tenantId };

					if (isNotEmpty(options?.where)) {
						const {
							organizationId,
							employeeIds,
							isHoliday,
							status,
							startDate,
							endDate,
							user,
							description,
							policy
						} = options.where;
						if (isNotEmpty(organizationId)) where.organizationId = organizationId;
						if (isNotEmpty(employeeIds)) where.employees = { id: { $in: employeeIds } };
						if (isNotEmpty(status)) where.status = status;
						if (isNotEmpty(isHoliday) && isNotEmpty(Boolean(JSON.parse(isHoliday))))
							where.isHoliday = false;
						if (hideArchived) where.isArchived = false;

						let sd = moment().startOf('month').utc().format('YYYY-MM-DD HH:mm:ss');
						let ed = moment().endOf('month').utc().format('YYYY-MM-DD HH:mm:ss');
						if (isNotEmpty(startDate) && isNotEmpty(endDate)) {
							sd = moment.utc(startDate).format('YYYY-MM-DD HH:mm:ss');
							ed = moment.utc(endDate).format('YYYY-MM-DD HH:mm:ss');
						}
						// Every time off overlapping the window: checking only whether its start or its end falls inside
						// left out one spanning the whole window (a leave from January 25 to March 5, listed for February)
						where.start = { $lte: ed };
						where.end = { $gte: sd };

						// Text search filters matching TypeORM branch (read from the client filter, not the query being built)
						if (isNotEmpty(user) && isNotEmpty(user.name)) {
							const keywords: string[] = splitKeywords(user.name);
							const userFilters: any[] = [];
							keywords.forEach((keyword: string) => {
								userFilters.push(
									{ employees: { user: { firstName: mikroOrmContains(keyword) } } },
									{ employees: { user: { lastName: mikroOrmContains(keyword) } } }
								);
							});
							// Only whitespace typed: no keyword, nothing to filter on
							// The date window no longer takes the `$or`: the name keywords have it to themselves
							if (userFilters.length > 0) {
								where.$or = userFilters;
							}
						}
						if (isNotEmpty(description)) {
							where.description = mikroOrmContains(description);
						}
						if (isNotEmpty(policy) && isNotEmpty(policy.name)) {
							where.policy = { name: mikroOrmContains(policy.name) };
						}
					}

					const [items, total] = await this.mikroOrmRepository.findAndCount(where, {
						populate: (options.relations || []) as any[],
						...(hasOrder ? { orderBy: order } : {}),
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
							// Same default page size as `take` below: a `skip` sent without `take` gave a NaN offset (400)
							skip: options.skip ? (options.take || 10) * (options.skip - 1) : 0,
							take: options.take ? options.take : 10,
							...(hasOrder ? { order } : {}),
							...(options.relations ? { relations: parseFindOptionsRelations(options.relations) } : {})
						});
					}
					/**
					 * The `join` find-option was removed in TypeORM v1 (passing it throws, which surfaced as a
					 * blanket 400 for every paginated request). Declare the aliases the raw predicates below
					 * rely on explicitly instead.
					 */
					query.leftJoin(`${query.alias}.policy`, 'policy');
					query.leftJoin(`${query.alias}.employees`, 'employees');
					query.leftJoin('employees.user', 'user');
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
									// Every time off overlapping the window, including one spanning all of it
									web.where({
										start: LessThanOrEqual(endDate),
										end: MoreThanOrEqual(startDate)
									});
								})
							);
							if (isNotEmpty(where.isHoliday) && isNotEmpty(Boolean(JSON.parse(where.isHoliday)))) {
								qb.andWhere({ isHoliday: false });
							}
							if (hideArchived) {
								qb.andWhere({ isArchived: false });
							}
							if (isNotEmpty(where.status)) {
								qb.andWhere({
									status: where.status
								});
							}
							qb.andWhere(
								new Brackets((web: WhereExpressionBuilder) => {
									if (isNotEmpty(where.user) && isNotEmpty(where.user.name)) {
										const keywords: string[] = splitKeywords(where.user.name);
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
