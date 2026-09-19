import { ForbiddenException, NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
	ID as Id,
	IDateRangePicker,
	IEmployee,
	IEmployeeCreateInput,
	IEmployeeUpdateInput,
	IFindMembersInput,
	IPagination,
	PermissionsEnum
} from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FeatureFlag } from '@gauzy/common';
import { RequestContext } from '../core/context';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { Employee } from './employee.entity';
import { EmployeeService } from './employee.service';
import {
	EmployeeBulkCreateCommand,
	EmployeeCreateCommand,
	EmployeeGetCommand,
	EmployeeUpdateCommand,
	WorkingEmployeeGetCommand
} from './commands';

/** The members `EmployeeUserInput` declares in the schema. */
export interface IEmployeeUserInput {
	email: string;
	firstName?: string;
	lastName?: string;
	imageUrl?: string;
	preferredLanguage?: string;
	roleId?: Id;
}

/** The members `CreateEmployeeInput` declares in the schema. */
export interface ICreateEmployeeInput {
	organizationId: Id;
	userId?: Id;
	user?: IEmployeeUserInput;
	password?: string;
	startedWorkOn?: Date;
	endWork?: Date;
	short_description?: string;
	description?: string;
	anonymousBonus?: boolean;
	employeeLevel?: string;
	organizationPositionId?: Id;
	tagIds?: Id[];
}

/** The members `UpdateEmployeeInput` declares in the schema. */
export interface IUpdateEmployeeInput {
	id: Id;
	startedWorkOn?: Date;
	endWork?: Date;
	short_description?: string;
	description?: string;
	anonymousBonus?: boolean;
	employeeLevel?: string;
	organizationPositionId?: Id;
	tagIds?: Id[];
	linkedInUrl?: string;
	facebookUrl?: string;
	instagramUrl?: string;
	twitterUrl?: string;
	githubUrl?: string;
	gitlabUrl?: string;
	upworkUrl?: string;
	stackoverflowUrl?: string;
	billRateValue?: number;
	billRateCurrency?: string;
	minimumBillingRate?: number;
	payPeriod?: string;
	reWeeklyLimit?: number;
	offerDate?: Date;
	acceptDate?: Date;
	rejectDate?: Date;
	upworkId?: string;
	linkedInId?: string;
	profile_link?: string;
	isAway?: boolean;
	show_anonymous_bonus?: boolean;
	show_average_bonus?: boolean;
	show_average_expenses?: boolean;
	show_average_income?: boolean;
	show_billrate?: boolean;
	show_payperiod?: boolean;
	show_start_work_on?: boolean;
	isActive?: boolean;
	isArchived?: boolean;
	isVerified?: boolean;
	isVetted?: boolean;
	isOnline?: boolean;
	isTrackingEnabled?: boolean;
	isTrackingTime?: boolean;
	isJobSearchActive?: boolean;
	allowScreenshotCapture?: boolean;
	allowManualTime?: boolean;
	allowModifyTime?: boolean;
	allowDeleteTime?: boolean;
	allowAgentAppExit?: boolean;
	allowLogoutFromAgentApp?: boolean;
	trackKeyboardMouseActivity?: boolean;
	trackAllDisplays?: boolean;
}

/** The members `UpdateEmployeeProfileInput` declares in the schema. */
export type IUpdateEmployeeProfileInput = Omit<
	IUpdateEmployeeInput,
		| 'show_anonymous_bonus'
		| 'show_average_bonus'
		| 'show_average_expenses'
		| 'show_average_income'
		| 'show_billrate'
		| 'show_payperiod'
		| 'show_start_work_on'
		| 'isActive'
		| 'isArchived'
		| 'isVerified'
		| 'isVetted'
		| 'isOnline'
		| 'isTrackingEnabled'
		| 'isTrackingTime'
		| 'isJobSearchActive'
		| 'allowScreenshotCapture'
		| 'allowManualTime'
		| 'allowModifyTime'
		| 'allowDeleteTime'
		| 'allowAgentAppExit'
		| 'allowLogoutFromAgentApp'
		| 'trackKeyboardMouseActivity'
		| 'trackAllDisplays'
>;

/**
 * The fields the employee list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `EmployeeFilter` and `EmployeeSortField` are its
 * two renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * Every member is a column of the row. Nothing is here from a relation, because the delivered list
 * read joins none: the connection protocol evaluates a filter against the rows the read returned, and
 * a member for a relation would narrow by a value those rows do not carry. The identifiers a relation
 * is carried as — `userId`, `contactId`, `organizationPositionId` — are filterable, which is the way to
 * ask for one organization's employees or for the engagements of one account.
 */
const EMPLOYEE_FILTERABLE = {
	id: 'ID',
	valueDate: 'DATE',
	short_description: 'STRING',
	description: 'STRING',
	startedWorkOn: 'DATE',
	endWork: 'DATE',
	payPeriod: 'STRING',
	billRateValue: 'DECIMAL',
	minimumBillingRate: 'DECIMAL',
	billRateCurrency: 'STRING',
	reWeeklyLimit: 'NUMBER',
	offerDate: 'DATE',
	acceptDate: 'DATE',
	rejectDate: 'DATE',
	employeeLevel: 'STRING',
	anonymousBonus: 'BOOLEAN',
	averageIncome: 'DECIMAL',
	averageBonus: 'DECIMAL',
	totalWorkHours: 'DECIMAL',
	averageExpenses: 'DECIMAL',
	totalJobs: 'DECIMAL',
	jobSuccess: 'DECIMAL',
	profile_link: 'STRING',
	isVerified: 'BOOLEAN',
	isVetted: 'BOOLEAN',
	isJobSearchActive: 'BOOLEAN',
	isTrackingEnabled: 'BOOLEAN',
	isOnline: 'BOOLEAN',
	isAway: 'BOOLEAN',
	isTrackingTime: 'BOOLEAN',
	allowScreenshotCapture: 'BOOLEAN',
	allowManualTime: 'BOOLEAN',
	allowModifyTime: 'BOOLEAN',
	allowDeleteTime: 'BOOLEAN',
	allowAgentAppExit: 'BOOLEAN',
	allowLogoutFromAgentApp: 'BOOLEAN',
	trackKeyboardMouseActivity: 'BOOLEAN',
	trackAllDisplays: 'BOOLEAN',
	upworkId: 'STRING',
	linkedInId: 'STRING',
	userId: 'ID',
	contactId: 'ID',
	organizationPositionId: 'ID',
	tenantId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	archivedAt: 'DATE',
	deletedAt: 'DATE',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the employee list's sort enum offers. */
const EMPLOYEE_SORTABLE = [
	'createdAt',
	'updatedAt',
	'startedWorkOn',
	'endWork',
	'short_description',
	'employeeLevel',
	'isActive',
	'isArchived',
	'isOnline',
	'isTrackingEnabled'
] as const;

/**
 * The fields the working-employees list may be filtered and sorted by.
 *
 * A vocabulary of its own rather than the list's, because that read projects a subset of the row: it
 * selects the engagement summary, the averages, the start date, the tracking flag, the two rates, the
 * account identifier and the two presence flags, and nothing else. Declaring a field the projection
 * does not carry would be a filter the schema offers and the evaluator refuses on every row.
 */
const WORKING_EMPLOYEE_FILTERABLE = {
	id: 'ID',
	short_description: 'STRING',
	description: 'STRING',
	startedWorkOn: 'DATE',
	averageIncome: 'DECIMAL',
	averageExpenses: 'DECIMAL',
	averageBonus: 'DECIMAL',
	isTrackingEnabled: 'BOOLEAN',
	billRateCurrency: 'STRING',
	billRateValue: 'DECIMAL',
	minimumBillingRate: 'DECIMAL',
	userId: 'ID',
	isAway: 'BOOLEAN',
	isOnline: 'BOOLEAN',
	tenantId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the working-employees list's sort enum offers. */
const WORKING_EMPLOYEE_SORTABLE = [
	'createdAt',
	'updatedAt',
	'startedWorkOn',
	'billRateValue',
	'isOnline',
	'isTrackingEnabled'
] as const;

/**
 * The fields the organization-members list may be filtered and sorted by.
 *
 * The narrowest of the three, and deliberately so: that read projects six columns — the identifier,
 * the two lifecycle flags, the account identifier and the two presence flags. It is the vocabulary a
 * picker needs and no more, and stating it here rather than borrowing the list's is what keeps the
 * schema from advertising a filter over a column the read never selected.
 */
const EMPLOYEE_MEMBER_FILTERABLE = {
	id: 'ID',
	userId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	isOnline: 'BOOLEAN',
	isAway: 'BOOLEAN',
	tenantId: 'ID',
	organizationId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the organization-members list's sort enum offers. */
const EMPLOYEE_MEMBER_SORTABLE = ['createdAt', 'updatedAt', 'isOnline', 'isAway'] as const;

/**
 * The order the connections apply when the caller states none.
 *
 * None of the three delivered reads states an order of its own — each hands the store a criterion and
 * takes the rows as they come back — so the connection applies the platform's own: newest first, with
 * the identifier as the last key so that two engagements filed in the same millisecond still have one
 * order between them, which is what makes a cursor walk over them stable.
 */
const EMPLOYEE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The employee over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `EmployeeService` method, or dispatches the same command,
 * that the `/api/employee` routes reach.
 *
 * **The guard chain and the class permission are the controller's.** The class carries
 * `TenantPermissionGuard` and `PermissionGuard` with the edit permission, which is what the controller
 * carries, and every field then states the permission its own route runs under — so a field is never
 * narrower or wider than the route it mirrors. The node query is the case that reads oddly and is
 * nevertheless the parity: the delivered `GET /:id` declares an *empty* permission list of its own —
 * which is why it does not run under the controller's class-level edit permission — so the field
 * declares the same empty list rather than nothing, because the two are different statements to the
 * guard and only one of them is the route's.
 *
 * **The scope the node query enforces is the handler's, and it is restated rather than approximated.**
 * That handler answers the caller's own engagement whatever identifier it names when the caller may not
 * change the selected employee, and refuses a caller that has no engagement at all. A resolver that
 * turned that into a permission would be a second answer to the same question, and the wrong one in
 * both directions.
 *
 * **The sensitive-relations interceptor is not restated, because there is nothing here for it to redact.**
 * The controller class carries `SensitiveRelationsInterceptor` over `ORGANIZATION_SENSITIVE_RELATIONS`,
 * which strips the organization relation's sensitive members from an answer. This surface's type
 * carries no relation object at all — every relation is either an identifier or absent — so the
 * projection it answers has already dropped everything that interceptor exists to remove.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('Employee')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ORG_EMPLOYEES_EDIT)
export class EmployeeResolver {
	constructor(private readonly employeeService: EmployeeService, private readonly commandBus: CommandBus) {}

	/**
	 * The engagements of the caller's tenant, newest first.
	 *
	 * The read is the delivered list route's own, criterion included: that route forces the account
	 * behind every row to be a live one before it hands the criterion to the service, so this field
	 * asks for the same rows rather than for every row of the tenant. The narrowing a caller states
	 * arrives in `filter` and is applied to the rows this call returns, which is the same set the route
	 * answers.
	 */
	@Query('employees')
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_VIEW)
	async employees(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Employee>> {
		// The criterion is the route's: only the engagements whose account is live and unarchived are
		// answered, and an archived account is what makes an engagement disappear from this list.
		const { items }: IPagination<IEmployee> = await this.employeeService.findAll({
			where: { user: { isActive: true, isArchived: false } }
		});

		return buildConnection<Employee>({
			rows: (items ?? []) as Employee[],
			filterable: EMPLOYEE_FILTERABLE,
			sortable: EMPLOYEE_SORTABLE,
			defaultSort: EMPLOYEE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One engagement of the caller's tenant.
	 *
	 * The criteria are the delivered handler's, read from the route's own body rather than re-derived:
	 * a caller that may change the selected employee reads the engagement it names; every other caller
	 * reads its own, whatever identifier it names, and is refused when it has no engagement at all. The
	 * read includes withdrawn rows, which is the route's own choice — an administration screen that
	 * cannot read a withdrawn engagement cannot recover it.
	 *
	 * A miss answers `null` rather than a refusal: GraphQL has one answer for "no such row" on a field
	 * that may have none, and the REST route's `404` is that same fact stated in the other protocol's
	 * vocabulary.
	 */
	@Query('employee')
	@Permissions()
	async employee(@Args('id', { type: () => ID }) id: Id): Promise<Employee | null> {
		const ownEmployeeId = RequestContext.currentEmployeeId();
		const maySelectAny = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);

		if (!maySelectAny && !ownEmployeeId) {
			throw new ForbiddenException('You do not have permission to view this employee.');
		}

		try {
			return await this.commandBus.execute(
				new EmployeeGetCommand({
					where: { ...(maySelectAny ? { id } : { id: ownEmployeeId }) },
					withDeleted: true
				})
			);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many engagements the caller's tenant holds.
	 *
	 * The same call the count route makes, with the same absence of narrowing: that route binds its
	 * query string to the store's own `where` and hands it to `countBy`, and the connection protocol
	 * has no argument of that shape, so the field passes none and counts the caller's own rows — the
	 * tenant is applied to the criterion by the service, from the credential.
	 */
	@Query('employeeCount')
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_VIEW)
	async employeeCount(): Promise<number> {
		return await this.employeeService.countBy();
	}

	/**
	 * The engagements of one organization that count as working over a range.
	 *
	 * The same command the working-employees route dispatches, with the same input: the range is the
	 * one the route reads out of its `data` parameter, and an absent range is the same statement here
	 * that it is there — the read then answers every live engagement of the organization. The command's
	 * `withUser` member is not an argument, because this surface's type carries no account member for
	 * it to fill: an argument whose effect is invisible is worse than an argument that is absent, and
	 * the handler's own default is what the command carries.
	 */
	@Query('workingEmployees')
	@Permissions(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE, PermissionsEnum.SELECT_EMPLOYEE)
	async workingEmployees(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
		@Args('endDate', { type: () => Date, nullable: true }) endDate?: Date,
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Employee>> {
		const { items }: IPagination<IEmployee> = await this.commandBus.execute(
			new WorkingEmployeeGetCommand({ organizationId, forRange: this.rangeOf(startDate, endDate) })
		);

		return buildConnection<Employee>({
			rows: (items ?? []) as Employee[],
			filterable: WORKING_EMPLOYEE_FILTERABLE,
			sortable: WORKING_EMPLOYEE_SORTABLE,
			defaultSort: EMPLOYEE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * How many engagements of one organization count as working over a range.
	 *
	 * The same service method the working-count route calls, with the same two arguments that route
	 * reads out of its request. The answer is the delivered method's own, which is a total and not a
	 * row — so the field states a number, and states it as nullable because that method answers nothing
	 * at all when its own query fails rather than answering a fabricated zero.
	 */
	@Query('workingEmployeeCount')
	@Permissions(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE, PermissionsEnum.SELECT_EMPLOYEE)
	async workingEmployeeCount(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
		@Args('endDate', { type: () => Date, nullable: true }) endDate?: Date
	): Promise<number | null> {
		const answer = await this.employeeService.findWorkingEmployeesCount(
			organizationId,
			this.rangeOf(startDate, endDate)
		);

		return answer?.total ?? null;
	}

	/**
	 * One organization's live roster, projected to the columns a picker needs.
	 *
	 * The same service method the members route calls, with the same three arguments that route binds
	 * from its query string. The team and the project narrow the read itself — each is a join the
	 * delivered method performs — which is why they are arguments of the field and not members of the
	 * connection's filter: the rows the read returns carry neither membership, so the connection could
	 * not narrow by either.
	 */
	@Query('employeeMembers')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_MEMBERS_VIEW)
	async employeeMembers(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('organizationTeamId', { type: () => ID, nullable: true }) organizationTeamId?: Id,
		@Args('organizationProjectId', { type: () => ID, nullable: true }) organizationProjectId?: Id,
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Employee>> {
		const { items }: IPagination<IEmployee> = await this.employeeService.findMembers({
			organizationId,
			organizationTeamId,
			organizationProjectId
		} as IFindMembersInput);

		return buildConnection<Employee>({
			rows: (items ?? []) as Employee[],
			filterable: EMPLOYEE_MEMBER_FILTERABLE,
			sortable: EMPLOYEE_MEMBER_SORTABLE,
			defaultSort: EMPLOYEE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * Files an engagement.
	 *
	 * The write is dispatched as the same command the create route dispatches, with the payload that
	 * route builds from its body: the row's own members as they are stated, the position as the
	 * identifier the relation is written from, and the tags as the identifiers the pivot is written
	 * from. The language and the origin are the request's own, exactly as the route reads them — the
	 * language decides the text of the answer and the origin is the link a newly filed account's
	 * welcome mail carries.
	 */
	@Mutation('createEmployee')
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_EDIT)
	async createEmployee(@Args('input') input: ICreateEmployeeInput): Promise<Employee> {
		return await this.commandBus.execute(
			new EmployeeCreateCommand(
				this.createPayload(input),
				RequestContext.getLanguageCode(),
				this.originOfTheCaller()
			)
		);
	}

	/**
	 * Files several engagements in one call.
	 *
	 * The same command the bulk route dispatches, with the same language and origin, and the same
	 * answer: the rows the handler created, in the order it created them.
	 */
	@Mutation('createEmployeesBulk')
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_EDIT)
	async createEmployeesBulk(@Args('input') input: ICreateEmployeeInput[]): Promise<Employee[]> {
		return await this.commandBus.execute(
			new EmployeeBulkCreateCommand(
				input.map((one) => this.createPayload(one)),
				RequestContext.getLanguageCode(),
				this.originOfTheCaller()
			)
		);
	}

	/**
	 * Edits an engagement that exists.
	 *
	 * The same command the update route dispatches, with the same payload. The handler refuses a caller
	 * that may edit only its own profile and names somebody else's engagement, so the check is not
	 * restated here — a second copy of it would be the one that drifts.
	 */
	@Mutation('updateEmployee')
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_EDIT)
	async updateEmployee(@Args('input') input: IUpdateEmployeeInput): Promise<Employee> {
		return await this.commandBus.execute(
			new EmployeeUpdateCommand(input.id, this.updatePayload(input))
		);
	}

	/**
	 * Edits an engagement's own profile.
	 *
	 * The same command the profile route dispatches, which is the same command the edit route dispatches
	 * — the two routes differ in the body their validation admits and in the permission they run under,
	 * not in what they call. The permission is the profile one and no other: a caller that holds it and
	 * not the organizational edit is exactly the caller this route exists for, and it is refused
	 * somebody else's engagement by the handler.
	 */
	@Mutation('updateEmployeeProfile')
	@Permissions(PermissionsEnum.PROFILE_EDIT)
	async updateEmployeeProfile(@Args('input') input: IUpdateEmployeeProfileInput): Promise<Employee> {
		return await this.commandBus.execute(
			new EmployeeUpdateCommand(input.id, this.updatePayload(input))
		);
	}

	/**
	 * Removes an engagement outright.
	 *
	 * The same service method the delete route calls, with the same narrowing: the organization the
	 * route reads out of its query string is handed to the store beside the identifier.
	 */
	@Mutation('deleteEmployee')
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_EDIT)
	async deleteEmployee(
		@Args('id', { type: () => ID }) id: Id,
		@Args('organizationId', { type: () => ID, nullable: true }) organizationId?: Id
	): Promise<boolean> {
		await this.employeeService.delete(id, { where: { organizationId } });

		return true;
	}

	/**
	 * Withdraws an engagement without removing it.
	 *
	 * The same service method the withdrawal route calls, with the same organization and the same
	 * relations loaded, because that method reads the row it is about to withdraw and the relations are
	 * part of what it answers.
	 */
	@Mutation('softDeleteEmployee')
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_EDIT)
	async softDeleteEmployee(
		@Args('id', { type: () => ID }) id: Id,
		@Args('organizationId', { type: () => ID, nullable: true }) organizationId?: Id
	): Promise<Employee> {
		return await this.employeeService.softRemovedById(id, { organizationId });
	}

	/**
	 * Puts a withdrawn engagement back.
	 *
	 * The same service method the recovery route calls. The route binds its parameters from the request
	 * body and this field takes the one that narrows the write, which is the same value stated in the
	 * other protocol's own place.
	 */
	@Mutation('recoverEmployee')
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_EDIT)
	async recoverEmployee(
		@Args('id', { type: () => ID }) id: Id,
		@Args('organizationId', { type: () => ID, nullable: true }) organizationId?: Id
	): Promise<Employee> {
		return await this.employeeService.softRecoverById(id, { organizationId });
	}

	/**
	 * The payload the create route builds from its body.
	 *
	 * The relations are stated as the identifiers the delivered write is written from — the position as
	 * `{ id }`, the tags as a list of `{ id }` — because that is the shape the service persists a
	 * relation in, and a caller stating an identifier is stating the same thing the REST body states
	 * with a row.
	 */
	private createPayload(input: ICreateEmployeeInput): IEmployeeCreateInput {
		return {
			organizationId: input.organizationId,
			userId: input.userId,
			user: input.user,
			password: input.password,
			startedWorkOn: input.startedWorkOn,
			endWork: input.endWork,
			short_description: input.short_description,
			description: input.description,
			anonymousBonus: input.anonymousBonus,
			employeeLevel: input.employeeLevel,
			organizationPosition: input.organizationPositionId ? { id: input.organizationPositionId } : undefined,
			tags: input.tagIds ? input.tagIds.map((id) => ({ id })) : undefined
		} as unknown as IEmployeeCreateInput;
	}

	/**
	 * The payload the two edit routes build from their bodies.
	 *
	 * A member the caller did not state is left undefined rather than written as a default, because the
	 * delivered handler merges the stated members over the row it read: saying nothing about a member is
	 * a different request from stating an empty one, and one builder serves both routes because both
	 * dispatch the same command over bodies of two shapes.
	 */
	private updatePayload(input: IUpdateEmployeeInput | IUpdateEmployeeProfileInput): IEmployeeUpdateInput {
		// The two identifier members are lifted out rather than passed beside their relations: the
		// delivered write persists the relations, and handing it an identifier column the entity does
		// not assign would be a second statement of the same fact.
		const { organizationPositionId, tagIds, ...members } = input;

		return {
			...members,
			organizationPosition: organizationPositionId ? { id: organizationPositionId } : undefined,
			tags: tagIds ? tagIds.map((id) => ({ id })) : undefined
		} as unknown as IEmployeeUpdateInput;
	}

	/**
	 * The range the two working-employees reads are narrowed by.
	 *
	 * Both stored procedures read exactly two members of the range and treat a range that states neither
	 * as "no range at all", so a caller that omits the two arguments gets the call its route makes when
	 * its `data` parameter carries no range — every live engagement of the organization.
	 */
	private rangeOf(startDate?: Date, endDate?: Date): IDateRangePicker | undefined {
		return startDate || endDate ? ({ startDate, endDate } as IDateRangePicker) : undefined;
	}

	/**
	 * The origin the request carries, which the two create routes hand to their handler.
	 *
	 * The controller reads it with `@Headers('origin')` and this reads the same header off the same
	 * request, so the two surfaces build the same welcome-mail link for the same caller. There is no
	 * request at all in a context that is not serving one, and the handler's own default is what the
	 * command then carries.
	 */
	private originOfTheCaller(): string | undefined {
		const request = RequestContext.currentRequest() as { headers?: Record<string, string> } | null;

		return request?.headers?.origin;
	}
}
