/**
 * The metadata store is loaded before this module is evaluated, because the permission below is read from
 * the controller's own decorator metadata at class-definition time rather than retyped here. The
 * application does that at bootstrap; a module that reads metadata while it is being defined is a module
 * that must not depend on the order a bootstrap happens to load things in.
 */
import 'reflect-metadata';

import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import {
	IActivity,
	IBulkActivitiesInput,
	ID as Id,
	IDailyActivity,
	IGetActivitiesInput,
	PermissionsEnum,
	ReportGroupFilterEnum
} from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../../api/graphql-connection';
import { Permissions } from '../../shared/decorators';
import {
	FeatureFlagGuard,
	PermissionGuard,
	TenantPermissionGuard
} from '../../shared/guards';
// Imported from its own module rather than through the `shared/guards` barrel, and the difference matters:
// `@UseGuards(...)` is evaluated when this class is defined, the barrel reaches `core/index.ts`, which reaches
// `core.module` and every domain module — so in some load orders the guard comes back `undefined` and Nest
// refuses the decorator with `Invalid guard passed to @UseGuards()`, taking the whole suite down with it.
import { EmployeeTrackedDataGuard } from '../../shared/guards/employee-tracked-data.guard';
import { FEATURE_GRAPHQL } from '../../feature/graphql-feature.code';
import { ActivityController } from './activity.controller';
import { Activity } from './activity.entity';
import { ActivityMapService } from './activity.map.service';
import { ActivityService } from './activity.service';

/** The activity band a read narrows to, as the delivered query states it. */
export interface IActivityLevelInput {
	readonly start: number;
	readonly end: number;
}

/**
 * The narrowing every read of this resource takes.
 *
 * It is the delivered query DTO's own member set, minus the page it carries: every member here is read by
 * the delivered services, and the page is deliberately not among them — see the `activities` field below.
 */
export interface IActivityQueryInput {
	readonly organizationId: Id;
	readonly startDate?: Date;
	readonly endDate?: Date;
	readonly employeeIds?: Id[];
	readonly projectIds?: Id[];
	readonly titles?: string[];
	readonly types?: string[];
	readonly source?: string[];
	readonly logType?: string[];
	readonly activityLevel?: IActivityLevelInput;
}

/** One row of the grouped report, as the delivered mapper answers it. */
export interface IDailyActivityReportRow {
	readonly sessions?: number;
	readonly duration?: number;
	readonly duration_percentage?: string | number;
	readonly employeeId?: Id;
	readonly projectId?: Id;
	readonly date?: string;
	readonly title?: string;
}

/** The row a group was nested under, as the delivered report read merged it. */
interface IMergedRow {
	readonly id?: Id;
}

/** One project's rows inside a day, as the delivered mapper nests them. */
interface IMappedProjectActivities {
	readonly project?: IMergedRow | null;
	readonly activity: IDailyActivityReportRow[];
}

/** One engagement's rows inside a day, as the delivered mapper nests them. */
interface IMappedEmployeeActivities {
	readonly employee?: IMergedRow | null;
	readonly activity: IDailyActivityReportRow[];
}

/** One engagement inside a day, with the projects it worked on. */
interface IMappedEmployeeProjects {
	readonly employee?: IMergedRow | null;
	readonly projects: IMappedProjectActivities[];
}

/** One day of a report grouped by date, with the engagements that were active in it. */
interface IMappedDayEmployeeProjects {
	readonly date: string;
	readonly employees?: IMappedEmployeeProjects[];
}

/** One day inside an engagement, with the projects worked on. */
interface IMappedDayProjects {
	readonly date: string;
	readonly projects?: IMappedProjectActivities[];
}

/** One day inside a project, with the engagements that worked on it. */
interface IMappedDayEmployees {
	readonly date: string;
	readonly employees?: IMappedEmployeeActivities[];
}

/** One engagement of a report grouped by employee, with the days it was active on. */
interface IMappedEmployee {
	readonly employee?: IMergedRow | null;
	readonly dates: IMappedDayProjects[];
}

/** One project of a report grouped by project, with the days it was worked on. */
interface IMappedProject {
	readonly project?: IMergedRow | null;
	readonly dates: IMappedDayEmployees[];
}

/** One engagement inside a day of a report grouped by date. */
export interface IDailyActivityReportEmployeeProjects {
	readonly employeeId: Id | null;
	readonly projects: IDailyActivityReportProjectGroup[];
}

/** One project's rows inside a day, as this surface declares them. */
export interface IDailyActivityReportProjectGroup {
	readonly projectId: Id | null;
	readonly activity: IDailyActivityReportRow[];
}

/** One engagement's rows inside a day, as this surface declares them. */
export interface IDailyActivityReportEmployeeGroup {
	readonly employeeId: Id | null;
	readonly activity: IDailyActivityReportRow[];
}

/** One day inside an engagement, as this surface declares it. */
export interface IDailyActivityReportDateProjects {
	readonly date: string;
	readonly projects: IDailyActivityReportProjectGroup[];
}

/** One day inside a project, as this surface declares it. */
export interface IDailyActivityReportDateEmployees {
	readonly date: string;
	readonly employees: IDailyActivityReportEmployeeGroup[];
}

/** One day of a report grouped by date, as this surface declares it. */
export interface IDailyActivityReportDate {
	readonly date: string;
	readonly employees: IDailyActivityReportEmployeeProjects[];
}

/** One engagement of a report grouped by employee, as this surface declares it. */
export interface IDailyActivityReportEmployee {
	readonly employeeId: Id | null;
	readonly dates: IDailyActivityReportDateProjects[];
}

/** One project of a report grouped by project, as this surface declares it. */
export interface IDailyActivityReportProject {
	readonly projectId: Id | null;
	readonly dates: IDailyActivityReportDateEmployees[];
}

/** The members `DailyActivityReport` declares in the schema, exactly one of which a call fills. */
export interface IDailyActivityReport {
	readonly activities?: IDailyActivityReportRow[];
	readonly dates?: IDailyActivityReportDate[];
	readonly employees?: IDailyActivityReportEmployee[];
	readonly projects?: IDailyActivityReportProject[];
}

/**
 * The fields an activity list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `ActivityFilter` and `ActivitySortField` are its two
 * renderings, and keeping the three in one file is what makes a field that is filterable in the schema but
 * unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * Every member is a column of the activity row, because that is what the connection protocol evaluates.
 * The narrowings the delivered reader performs on the rows it *joins* — the slot's activity band and the
 * log's source and kind — are not columns of an activity and are therefore arguments of the root field
 * rather than members here: a condition the returned rows carry none of is a filter that selects nothing.
 */
const ACTIVITY_FILTERABLE = {
	id: 'ID',
	title: 'STRING',
	description: 'STRING',
	metaData: 'JSON',
	date: 'STRING',
	time: 'STRING',
	duration: 'NUMBER',
	type: 'STRING',
	source: 'STRING',
	recordedAt: 'DATE',
	employeeId: 'ID',
	projectId: 'ID',
	timeSlotId: 'ID',
	taskId: 'ID',
	tenantId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	archivedAt: 'DATE',
	deletedAt: 'DATE',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const ACTIVITY_SORTABLE = [
	'createdAt',
	'updatedAt',
	'date',
	'time',
	'duration',
	'title',
	'type',
	'source',
	'recordedAt'
] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list method **does** state an order of its own — it hands the store `duration DESC` and
 * takes the rows as they come back — and the connection restates it here rather than choosing one of its
 * own. That is not a formality: the connection re-orders the rows it was given, so an order the connection
 * did not restate would be an order the read asked for and did not get. The identifier follows as the last
 * key, because two activities of the same length still need one order between them for a cursor walk over
 * them to be stable.
 */
const ACTIVITY_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'duration', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The permission every route of this controller runs under.
 *
 * Read from the controller's own metadata rather than retyped: neither of its handlers states a permission
 * of its own, so the class-level list is what the guard resolves for all four routes — and reading it here
 * is what makes a change to the controller's declaration reach this surface instead of leaving GraphQL a
 * scope REST no longer has, or the reverse.
 */
const ACTIVITY_PERMISSIONS = (Reflect.getMetadata(PERMISSIONS_METADATA, ActivityController) ??
	[]) as PermissionsEnum[];

/**
 * Tracked activity over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below calls the same `ActivityService` method, and the report calls the same
 * `ActivityMapService` grouping, that the `/timesheet/activity` routes call.
 *
 * **The guard chain and the permission are the controller's.** The class carries the same two guards the
 * controller carries, in the same order, plus the gate; every field states the permission the controller's
 * own metadata states, which for this controller is its class-level pair, because no handler of it
 * overrides that.
 *
 * **The tracked-data guard is the route's as well, and it is per route on both surfaces.** The three read
 * routes state `EmployeeTrackedDataGuard`, which applies the organization's `allowEmployeeToSeeTrackedData`
 * setting: an activity row is a window title, a URL or an application name stamped with who was in front of
 * it and when, and that is the organization's to withhold from its own employees. The three reads below
 * state the same guard, because a field that answered one without it would serve over this protocol a read
 * the REST route refuses — the same capability decided two ways with GraphQL as the permissive side, which
 * for tracked data is a privacy defect rather than a cosmetic mismatch. The bulk write mirrors the one route
 * that carries no such guard, and it carries none here either: recording is what produces tracked data, so
 * gating it would stop the tracker rather than protect anyone. `EmployeeTrackedDataGuard` injects only the
 * global `DataSource`, which `TypeOrmCoreModule` exports to every module, so this module can construct it as
 * it constructs the three guards above.
 *
 * **The list is the connection and the two computations are root fields of their own.** The daily read and
 * the report do not answer activity rows — they fold them — so neither is a narrowing of the list; the
 * module comment in `activity.api.gql` states the reasoning for both.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so every field below is behind the one capability.
 * `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the class, which is
 * why the gate is stated on the class rather than restated on each field — and why it is appended to the
 * guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('Activity')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(...ACTIVITY_PERMISSIONS)
export class ActivityResolver {
	constructor(
		private readonly activityService: ActivityService,
		private readonly activityMapService: ActivityMapService
	) {}

	/**
	 * The activities of one organization, longest first.
	 *
	 * **The read is the delivered list route's own, with one member of its query deliberately left out.**
	 * That route fills `{ page: 0, limit: 30 }` into its query before it calls the service, and that is the
	 * route's page: this surface's page is the connection's own, stated in `first`/`after`/`last`/`before`
	 * and in `limit`/`offset`, with the platform's default of twenty rows and its cap of a hundred. Handing
	 * the route's thirty-row window to the read as well would stack one window on the other and would make
	 * `totalCount` the count of a page rather than the count of everything the narrowing selects, which is
	 * the one number a cursor walk cannot recover from. A caller that wants the REST default exactly states
	 * `limit: 30`.
	 *
	 * The narrowing the route reads out of its query string is handed over as the route hands it over. The
	 * caller's own `filter` is applied to the rows this call returns, which is the same set the route
	 * answers before its page.
	 */
	@Query('activities')
	@Permissions(...ACTIVITY_PERMISSIONS)
	@UseGuards(EmployeeTrackedDataGuard)
	async activities(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
		@Args('endDate', { type: () => Date, nullable: true }) endDate?: Date,
		@Args('employeeIds', { type: () => [ID], nullable: true }) employeeIds?: Id[],
		@Args('projectIds', { type: () => [ID], nullable: true }) projectIds?: Id[],
		@Args('titles', { type: () => [String], nullable: true }) titles?: string[],
		@Args('types', { type: () => [String], nullable: true }) types?: string[],
		@Args('source', { type: () => [String], nullable: true }) source?: string[],
		@Args('logType', { type: () => [String], nullable: true }) logType?: string[],
		@Args('activityLevel', { nullable: true }) activityLevel?: IActivityLevelInput,
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Activity>> {
		const items: IActivity[] = await this.activityService.getActivities(
			this.queryOf({
				organizationId,
				startDate,
				endDate,
				employeeIds,
				projectIds,
				titles,
				types,
				source,
				logType,
				activityLevel
			})
		);

		return buildConnection<Activity>({
			rows: (items ?? []) as Activity[],
			filterable: ACTIVITY_FILTERABLE,
			sortable: ACTIVITY_SORTABLE,
			defaultSort: ACTIVITY_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One day's tracked time per engagement and title.
	 *
	 * The same call the daily route makes with the same input: the delivered read groups the activities by
	 * day, title and engagement and answers a count and a sum per group, which is a computation over the
	 * rows rather than a page of them — so this field answers the computed rows and takes no page at all.
	 * The route hands its query straight to the reader, so this field hands over exactly what the caller
	 * stated and nothing else.
	 */
	@Query('dailyActivities')
	@Permissions(...ACTIVITY_PERMISSIONS)
	@UseGuards(EmployeeTrackedDataGuard)
	async dailyActivities(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
		@Args('endDate', { type: () => Date, nullable: true }) endDate?: Date,
		@Args('employeeIds', { type: () => [ID], nullable: true }) employeeIds?: Id[],
		@Args('projectIds', { type: () => [ID], nullable: true }) projectIds?: Id[],
		@Args('titles', { type: () => [String], nullable: true }) titles?: string[],
		@Args('types', { type: () => [String], nullable: true }) types?: string[],
		@Args('source', { type: () => [String], nullable: true }) source?: string[],
		@Args('logType', { type: () => [String], nullable: true }) logType?: string[],
		@Args('activityLevel', { nullable: true }) activityLevel?: IActivityLevelInput
	): Promise<IDailyActivity[]> {
		return await this.activityService.getDailyActivities(
			this.queryOf({
				organizationId,
				startDate,
				endDate,
				employeeIds,
				projectIds,
				titles,
				types,
				source,
				logType,
				activityLevel
			})
		);
	}

	/**
	 * The report of tracked time, nested the way the caller asks.
	 *
	 * The route reads the report rows and then nests them — by date, by engagement or by project — through
	 * the mapper, and this field performs the same branch over the same rows rather than leaving the
	 * nesting to the client: the nesting is part of the answer's shape, and a client that had to rebuild it
	 * would be rebuilding the delivered arithmetic too.
	 *
	 * The mapper nests the *rows* it was handed, and the engagement and project rows the read merged beside
	 * them; this field projects each group down to the identifier it is keyed by, because those two rows
	 * belong to the domains that own them and are not re-declared on this surface. The projection states
	 * which engagement and which project a group is using the value the mapper grouped on, so no group is
	 * re-identified by a second copy of the same fact.
	 */
	@Query('dailyActivitiesReport')
	@Permissions(...ACTIVITY_PERMISSIONS)
	@UseGuards(EmployeeTrackedDataGuard)
	async dailyActivitiesReport(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('groupBy', { type: () => String, nullable: true }) groupBy?: string,
		@Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
		@Args('endDate', { type: () => Date, nullable: true }) endDate?: Date,
		@Args('employeeIds', { type: () => [ID], nullable: true }) employeeIds?: Id[],
		@Args('projectIds', { type: () => [ID], nullable: true }) projectIds?: Id[],
		@Args('titles', { type: () => [String], nullable: true }) titles?: string[],
		@Args('types', { type: () => [String], nullable: true }) types?: string[],
		@Args('source', { type: () => [String], nullable: true }) source?: string[],
		@Args('logType', { type: () => [String], nullable: true }) logType?: string[],
		@Args('activityLevel', { nullable: true }) activityLevel?: IActivityLevelInput
	): Promise<IDailyActivityReport> {
		const activities: IActivity[] = await this.activityService.getDailyActivitiesReport(
			this.queryOf({
				organizationId,
				startDate,
				endDate,
				employeeIds,
				projectIds,
				titles,
				types,
				source,
				logType,
				activityLevel
			})
		);

		return this.reportOf(groupBy, activities);
	}

	/**
	 * Files several activities in one call.
	 *
	 * The same service method the bulk route calls, with the same body: the delivered write dispatches a
	 * command that stamps the organization, the tenant, the engagement and the project of the request onto
	 * every row, and answers the rows it saved in the order it saved them — which is what this field
	 * answers.
	 */
	@Mutation('bulkSaveActivities')
	@Permissions(...ACTIVITY_PERMISSIONS)
	async bulkSaveActivities(@Args('input') input: IBulkActivitiesInput): Promise<IActivity[]> {
		return await this.activityService.bulkSave(input);
	}

	/**
	 * The narrowing the delivered reads take, built from what the caller stated.
	 *
	 * The delivered services read these ten members out of the request and build their criterion from them;
	 * the query DTO's remaining member — the page — is deliberately not among them, for the reason the
	 * `activities` field states.
	 */
	private queryOf(input: IActivityQueryInput): IGetActivitiesInput {
		return {
			organizationId: input.organizationId,
			startDate: input.startDate,
			endDate: input.endDate,
			employeeIds: input.employeeIds,
			projectIds: input.projectIds,
			titles: input.titles,
			types: input.types,
			source: input.source,
			logType: input.logType,
			activityLevel: input.activityLevel
		} as unknown as IGetActivitiesInput;
	}

	/**
	 * The grouped report, nested as `DailyActivityReport` declares it.
	 *
	 * The branch is the delivered route's own, over the mapper's own three groupings: the rows are read
	 * once and nested one way, and a request that states a grouping the route does not honour is answered
	 * the rows themselves — which is what the route does with it, and why no such value is offered in the
	 * schema.
	 */
	private reportOf(groupBy: string | undefined, activities: IActivity[]): IDailyActivityReport {
		if (groupBy === ReportGroupFilterEnum.date) {
			const days = this.activityMapService.mapByDate(activities) as IMappedDayEmployeeProjects[];

			return {
				dates: days.map((day) => ({
					date: day.date,
					employees: (day.employees ?? []).map((byEmployee) => ({
						employeeId: this.identifierOf(byEmployee.employee),
						projects: byEmployee.projects.map((byProject) => ({
							projectId: this.identifierOf(byProject.project),
							activity: byProject.activity
						}))
					}))
				}))
			};
		}

		if (groupBy === ReportGroupFilterEnum.employee) {
			const employees = this.activityMapService.mapByEmployee(activities) as IMappedEmployee[];

			return {
				employees: employees.map((byEmployee) => ({
					employeeId: this.identifierOf(byEmployee.employee),
					dates: byEmployee.dates.map((day) => ({
						date: day.date,
						projects: (day.projects ?? []).map((byProject) => ({
							projectId: this.identifierOf(byProject.project),
							activity: byProject.activity
						}))
					}))
				}))
			};
		}

		if (groupBy === ReportGroupFilterEnum.project) {
			const projects = this.activityMapService.mapByProject(activities) as IMappedProject[];

			return {
				projects: projects.map((byProject) => ({
					projectId: this.identifierOf(byProject.project),
					dates: byProject.dates.map((day) => ({
						date: day.date,
						employees: (day.employees ?? []).map((byEmployee) => ({
							employeeId: this.identifierOf(byEmployee.employee),
							activity: byEmployee.activity
						}))
					}))
				}))
			};
		}

		return { activities: activities as unknown as IDailyActivityReportRow[] };
	}

	/**
	 * The identifier of the row a group was nested under, or null when the read merged none.
	 *
	 * The mapper keys a group by the identifier it grouped on and nests the whole row it read beside it, so
	 * the two always agree; this reads the identifier off the row that carries it rather than inventing a
	 * second copy of the same fact.
	 */
	private identifierOf(row: IMergedRow | null | undefined): Id | null {
		return row?.id ?? null;
	}
}
