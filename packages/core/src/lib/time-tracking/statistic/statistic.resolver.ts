import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Query, Resolver } from '@nestjs/graphql';
import {
	IActivitiesStatistics,
	ICountsStatistics,
	ID as Id,
	IGetActivitiesStatistics,
	IGetCountsStatistics,
	IGetManualTimesStatistics,
	IGetMembersStatistics,
	IGetProjectsStatistics,
	IGetTasksStatistics,
	IGetTimeSlotStatistics,
	IManualTimesStatistics,
	IMembersStatistics,
	IProjectsStatistics,
	ITasksStatistics,
	ITimeSlotStatistics,
	PermissionsEnum
} from '@gauzy/contracts';
import { FeatureFlag } from '@gauzy/common';
import { Permissions } from '../../shared/decorators';
import {
	EmployeeTrackedDataGuard,
	FeatureFlagGuard,
	PermissionGuard,
	TenantPermissionGuard
} from '../../shared/guards';
import { FEATURE_GRAPHQL } from '../../feature/graphql-feature.code';
import { StatisticService } from './statistic.service';

/**
 * The activity band a read narrows time slots by, as `TimeTrackingActivityLevelInput` declares it.
 *
 * An interface rather than a class, because the schema states the shape and this declaration only
 * gives the two members the delivered reads actually consult a type: the service multiplies each of
 * them by six before it reaches the store, so they are the same 0-to-100 percentages the REST query
 * string carries rather than the slot counts the column holds.
 */
export interface ITimeTrackingActivityLevel {
	start: number;
	end: number;
}

/**
 * The time-tracking statistics over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `StatisticService` method the `/api/timesheet/statistics`
 * routes reach, with the same request the route binds from its query string or its body.
 *
 * **The seven fields are computed answers, not resources.** The platform stores time logs, time slots
 * and activities; it stores no statistic, so each answer below is calculated on the request out of
 * those rows over a range. That is why this surface has no connection, no node field, no count field
 * and no write: the controller serves seven `GET` routes and one `POST`, and the `POST` is a read —
 * `POST /tasks` carries its filter in its body only because that filter is too wide for a query
 * string, and what it answers is a computation rather than a change. Here it is a `Query` field like
 * its six siblings, which is the operation it always was.
 *
 * **The guard chain and the permission are the controller's.** `StatisticController` carries
 * `TenantPermissionGuard` and `PermissionGuard` at class level with
 * `ADMIN_DASHBOARD_VIEW, TIME_TRACKER, ALL_ORG_EDIT, ALL_ORG_VIEW`, and none of its seven handlers
 * states a permission of its own — so every route runs under that list, and every field below states
 * it. A caller that may read the dashboard over REST is therefore the caller that may read it here,
 * and no field is narrower or wider than the route it mirrors.
 *
 * **The tracked-data guard is the route's as well, and it is per route on both surfaces.** Six of the
 * seven routes below state `EmployeeTrackedDataGuard`, which applies the organization's
 * `allowEmployeeToSeeTrackedData` setting: who was tracked, when, and on what is the organization's to
 * withhold from its own employees. A field that answered that without the guard would serve over this
 * protocol a read the REST route refuses — the same capability decided two ways with GraphQL as the
 * permissive side, which for tracked data is a privacy defect rather than a cosmetic mismatch. The
 * guard is therefore stated on each of those six fields rather than on the class, because the seventh
 * route — the desktop timer's task picker, `POST /tasks` — deliberately carries none, and a
 * class-level guard here would refuse `timeTrackingTasks` a read its route serves.
 * `EmployeeTrackedDataGuard` injects only the global `DataSource`, which `TypeOrmCoreModule` exports
 * to every module, so the module that declares this resolver can construct it as it constructs the
 * three guards above.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 *
 * **The organization is required and the range is not.** Every read below resolves its rows through an
 * organization and none of them has a default for it, so `organizationId` is a required argument. A
 * range, by contrast, has a delivered default in the read itself — the current week, or the current
 * day for the two `today` members — so an absent range here is the same statement it is on the route.
 */
@Resolver()
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(
	PermissionsEnum.ADMIN_DASHBOARD_VIEW,
	PermissionsEnum.TIME_TRACKER,
	PermissionsEnum.ALL_ORG_EDIT,
	PermissionsEnum.ALL_ORG_VIEW
)
export class StatisticResolver {
	constructor(private readonly statisticService: StatisticService) {}

	/**
	 * How much of the caller's organization worked, on what, and how actively, over a range.
	 *
	 * The same service method `GET /counts` calls, with the same request: four counts computed
	 * concurrently — the employees and the projects that tracked time over the range, and the same two
	 * figures for today — plus the average activity and the tracked duration behind each of the two
	 * periods.
	 *
	 * **`todayStart` and `todayEnd` are stated separately from the range, and their absence changes the
	 * delivered answer.** The two `today` figures are computed over their own period, which the read
	 * defaults to the current day; a caller that states neither gets today, and a caller that states
	 * only the range still gets today rather than the range. That is the delivered behaviour, and the
	 * field passes the two members through unsubstituted.
	 */
	@Query('timeTrackingCounts')
	@Permissions(
		PermissionsEnum.ADMIN_DASHBOARD_VIEW,
		PermissionsEnum.TIME_TRACKER,
		PermissionsEnum.ALL_ORG_EDIT,
		PermissionsEnum.ALL_ORG_VIEW
	)
	@UseGuards(EmployeeTrackedDataGuard)
	async timeTrackingCounts(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
		@Args('endDate', { type: () => Date, nullable: true }) endDate?: Date,
		@Args('todayStart', { type: () => Date, nullable: true }) todayStart?: Date,
		@Args('todayEnd', { type: () => Date, nullable: true }) todayEnd?: Date,
		@Args('employeeIds', { type: () => [ID], nullable: true }) employeeIds?: Id[],
		@Args('projectIds', { type: () => [ID], nullable: true }) projectIds?: Id[],
		@Args('teamIds', { type: () => [ID], nullable: true }) teamIds?: Id[],
		@Args('activityLevel', { nullable: true }) activityLevel?: ITimeTrackingActivityLevel,
		@Args('logType', { type: () => [String], nullable: true }) logType?: string[],
		@Args('source', { type: () => [String], nullable: true }) source?: string[],
		@Args('onlyMe', { type: () => Boolean, nullable: true }) onlyMe?: boolean
	): Promise<ICountsStatistics> {
		return await this.statisticService.getCounts({
			organizationId,
			startDate,
			endDate,
			todayStart,
			todayEnd,
			employeeIds,
			projectIds,
			teamIds,
			activityLevel,
			logType,
			source,
			onlyMe
		} as IGetCountsStatistics);
	}

	/**
	 * The members of the caller's organization who tracked time over a range, with the hours behind them.
	 *
	 * The same service method `GET /members` calls, with the same request. Each answer is one member
	 * with the total tracked duration over the range, the same total for today, the activity percentage
	 * behind each of the two, the per-day-of-week hours of the range, and the two presence flags.
	 *
	 * **The account behind a member is carried as the name and the image it is answered with**, which is
	 * what the delivered read fills: it loads the accounts of the members it found in one batch and
	 * projects those two members onto each row. This field therefore offers neither `onlyMe` nor the
	 * activity band: the delivered read consults neither, and an argument that cannot change the answer
	 * is not published.
	 */
	@Query('timeTrackingMembers')
	@Permissions(
		PermissionsEnum.ADMIN_DASHBOARD_VIEW,
		PermissionsEnum.TIME_TRACKER,
		PermissionsEnum.ALL_ORG_EDIT,
		PermissionsEnum.ALL_ORG_VIEW
	)
	@UseGuards(EmployeeTrackedDataGuard)
	async timeTrackingMembers(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
		@Args('endDate', { type: () => Date, nullable: true }) endDate?: Date,
		@Args('todayStart', { type: () => Date, nullable: true }) todayStart?: Date,
		@Args('todayEnd', { type: () => Date, nullable: true }) todayEnd?: Date,
		@Args('employeeIds', { type: () => [ID], nullable: true }) employeeIds?: Id[],
		@Args('projectIds', { type: () => [ID], nullable: true }) projectIds?: Id[],
		@Args('teamIds', { type: () => [ID], nullable: true }) teamIds?: Id[]
	): Promise<IMembersStatistics[]> {
		return await this.statisticService.getMembers({
			organizationId,
			startDate,
			endDate,
			todayStart,
			todayEnd,
			employeeIds,
			projectIds,
			teamIds
		} as IGetMembersStatistics);
	}

	/**
	 * The projects of the caller's organization that were worked on over a range, busiest first.
	 *
	 * The same service method `GET /projects` calls, with the same request, and the same answer: the
	 * five projects with the most tracked time over the range, each with its duration and the share of
	 * the range's tracked time that duration is. A sixth project is not missing from the answer — the
	 * delivered read takes five, and a caller that needs the whole set asks the project surface for it.
	 *
	 * `onlyMe` is a member of this read and of the two beside it: the delivered method narrows the
	 * employees it may consider to the caller's own engagement when it is set, which is a different
	 * answer rather than a narrower page.
	 */
	@Query('timeTrackingProjects')
	@Permissions(
		PermissionsEnum.ADMIN_DASHBOARD_VIEW,
		PermissionsEnum.TIME_TRACKER,
		PermissionsEnum.ALL_ORG_EDIT,
		PermissionsEnum.ALL_ORG_VIEW
	)
	@UseGuards(EmployeeTrackedDataGuard)
	async timeTrackingProjects(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
		@Args('endDate', { type: () => Date, nullable: true }) endDate?: Date,
		@Args('employeeIds', { type: () => [ID], nullable: true }) employeeIds?: Id[],
		@Args('projectIds', { type: () => [ID], nullable: true }) projectIds?: Id[],
		@Args('teamIds', { type: () => [ID], nullable: true }) teamIds?: Id[],
		@Args('onlyMe', { type: () => Boolean, nullable: true }) onlyMe?: boolean
	): Promise<IProjectsStatistics[]> {
		return await this.statisticService.getProjects({
			organizationId,
			startDate,
			endDate,
			employeeIds,
			projectIds,
			teamIds,
			onlyMe
		} as IGetProjectsStatistics);
	}

	/**
	 * The tasks of the caller's organization that were worked on, with the time each took today.
	 *
	 * The same service method `POST /tasks` calls, with the same request — and this field is a `Query`
	 * even though its route is a `POST`, because the verb there is a transport decision and not a
	 * semantic one: the filter travels in the body because it is too wide for a query string, and what
	 * the route answers is a computation over time logs. A client asking this question changes nothing,
	 * so it asks it with a query.
	 *
	 * **Three arguments change the shape of the answer rather than narrowing a set, and each is stated
	 * because of that.** `taskIds` selects which tasks are considered; `organizationTeamId` narrows the
	 * read to one team beside `teamIds` rather than replacing it, because the delivered criterion is an
	 * either-or over the two; and `take` truncates the answer *after* the per-task totals have been
	 * aggregated, so an absent `take` answers every task the range touched. `defaultRange` and
	 * `unitOfTime` are the delivered read's own: with no range stated they make the read compute one —
	 * the current week, or the unit the caller names — and with no `defaultRange` the read answers the
	 * tasks of the whole history, which is the route's default as well. An absent `unitOfTime` is the
	 * read's own `week` for the range and its own `day` for the today figures, so this field substitutes
	 * neither.
	 *
	 * **This is the one field of the seven that carries no `EmployeeTrackedDataGuard`, because it
	 * mirrors the one route of the seven that carries none.** The task picker of the desktop timer needs
	 * this read to start tracking, so gating it would refuse a caller a read its route serves — which is
	 * the failure the guard's per-route placement on both surfaces exists to avoid, not one it is meant
	 * to cause.
	 */
	@Query('timeTrackingTasks')
	@Permissions(
		PermissionsEnum.ADMIN_DASHBOARD_VIEW,
		PermissionsEnum.TIME_TRACKER,
		PermissionsEnum.ALL_ORG_EDIT,
		PermissionsEnum.ALL_ORG_VIEW
	)
	async timeTrackingTasks(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
		@Args('endDate', { type: () => Date, nullable: true }) endDate?: Date,
		@Args('todayStart', { type: () => Date, nullable: true }) todayStart?: Date,
		@Args('todayEnd', { type: () => Date, nullable: true }) todayEnd?: Date,
		@Args('employeeIds', { type: () => [ID], nullable: true }) employeeIds?: Id[],
		@Args('projectIds', { type: () => [ID], nullable: true }) projectIds?: Id[],
		@Args('taskIds', { type: () => [ID], nullable: true }) taskIds?: Id[],
		@Args('teamIds', { type: () => [ID], nullable: true }) teamIds?: Id[],
		@Args('organizationTeamId', { type: () => ID, nullable: true }) organizationTeamId?: Id,
		@Args('take', { type: () => Int, nullable: true }) take?: number,
		@Args('defaultRange', { type: () => Boolean, nullable: true }) defaultRange?: boolean,
		@Args('unitOfTime', { type: () => String, nullable: true }) unitOfTime?: string,
		@Args('onlyMe', { type: () => Boolean, nullable: true }) onlyMe?: boolean
	): Promise<ITasksStatistics[]> {
		return await this.statisticService.getTasks({
			organizationId,
			startDate,
			endDate,
			todayStart,
			todayEnd,
			employeeIds,
			projectIds,
			taskIds,
			teamIds,
			organizationTeamId,
			take,
			defaultRange,
			unitOfTime,
			onlyMe
		} as IGetTasksStatistics);
	}

	/**
	 * The manual time logs of the caller's organization, newest first.
	 *
	 * The same service method `GET /manual-times` calls, with the same request, and the same answer:
	 * the five most recently started manual logs of the range, each with the time it took, the name and
	 * image of the account behind it, and the name and image of the project it was filed against.
	 *
	 * The employee behind a log is carried as the identifier rather than as a row, and that is the
	 * delivered answer's own shape: the two reads behind this method — one per ORM — agree on the
	 * identifier and on nothing else, because one selects the engagement and the other projects its
	 * identifier into the answer. A member that is filled by one read and empty on the other is worse
	 * than the identifier both fill.
	 */
	@Query('timeTrackingManualTimes')
	@Permissions(
		PermissionsEnum.ADMIN_DASHBOARD_VIEW,
		PermissionsEnum.TIME_TRACKER,
		PermissionsEnum.ALL_ORG_EDIT,
		PermissionsEnum.ALL_ORG_VIEW
	)
	@UseGuards(EmployeeTrackedDataGuard)
	async timeTrackingManualTimes(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
		@Args('endDate', { type: () => Date, nullable: true }) endDate?: Date,
		@Args('employeeIds', { type: () => [ID], nullable: true }) employeeIds?: Id[],
		@Args('projectIds', { type: () => [ID], nullable: true }) projectIds?: Id[],
		@Args('teamIds', { type: () => [ID], nullable: true }) teamIds?: Id[],
		@Args('onlyMe', { type: () => Boolean, nullable: true }) onlyMe?: boolean
	): Promise<IManualTimesStatistics[]> {
		return await this.statisticService.manualTimes({
			organizationId,
			startDate,
			endDate,
			employeeIds,
			projectIds,
			teamIds,
			onlyMe
		} as IGetManualTimesStatistics);
	}

	/**
	 * The three members of the caller's organization who tracked time most recently, with their slots.
	 *
	 * The same service method `GET /time-slots` calls, with the same request, and the same answer: per
	 * employee, the instant of that employee's most recent log in the range, the two presence flags,
	 * the name and image of the account behind the engagement, and up to nine of that employee's most
	 * recent time slots of the range with the screenshots filed against each.
	 *
	 * The delivered read answers three employees, so three is what this field answers; a caller that
	 * needs every employee's slots asks the time-slot surface for them over its own range. A slot
	 * carries the identifier of the engagement it belongs to rather than the engagement, because the
	 * delivered reads fill a row on one and an identifier on the other.
	 */
	@Query('timeTrackingTimeSlots')
	@Permissions(
		PermissionsEnum.ADMIN_DASHBOARD_VIEW,
		PermissionsEnum.TIME_TRACKER,
		PermissionsEnum.ALL_ORG_EDIT,
		PermissionsEnum.ALL_ORG_VIEW
	)
	@UseGuards(EmployeeTrackedDataGuard)
	async timeTrackingTimeSlots(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
		@Args('endDate', { type: () => Date, nullable: true }) endDate?: Date,
		@Args('employeeIds', { type: () => [ID], nullable: true }) employeeIds?: Id[],
		@Args('projectIds', { type: () => [ID], nullable: true }) projectIds?: Id[],
		@Args('teamIds', { type: () => [ID], nullable: true }) teamIds?: Id[],
		@Args('onlyMe', { type: () => Boolean, nullable: true }) onlyMe?: boolean
	): Promise<ITimeSlotStatistics[]> {
		return await this.statisticService.getEmployeeTimeSlots({
			organizationId,
			startDate,
			endDate,
			employeeIds,
			projectIds,
			teamIds,
			onlyMe
		} as IGetTimeSlotStatistics);
	}

	/**
	 * What the caller's organization spent its time on over a range, most time first.
	 *
	 * The same service method `GET /activities` calls, with the same request, and the same answer: the
	 * five activity titles with the most tracked time over the range, each with the number of sessions
	 * it was recorded in, the seconds it accounts for, and the share of the range's recorded activity
	 * that is.
	 *
	 * The share is computed against the whole of the range's recorded activity, not against the five
	 * answers, which is why the five shares are a fraction of the period rather than a distribution
	 * that adds up to one.
	 */
	@Query('timeTrackingActivities')
	@Permissions(
		PermissionsEnum.ADMIN_DASHBOARD_VIEW,
		PermissionsEnum.TIME_TRACKER,
		PermissionsEnum.ALL_ORG_EDIT,
		PermissionsEnum.ALL_ORG_VIEW
	)
	@UseGuards(EmployeeTrackedDataGuard)
	async timeTrackingActivities(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
		@Args('endDate', { type: () => Date, nullable: true }) endDate?: Date,
		@Args('employeeIds', { type: () => [ID], nullable: true }) employeeIds?: Id[],
		@Args('projectIds', { type: () => [ID], nullable: true }) projectIds?: Id[],
		@Args('teamIds', { type: () => [ID], nullable: true }) teamIds?: Id[],
		@Args('onlyMe', { type: () => Boolean, nullable: true }) onlyMe?: boolean
	): Promise<IActivitiesStatistics[]> {
		return await this.statisticService.getActivities({
			organizationId,
			startDate,
			endDate,
			employeeIds,
			projectIds,
			teamIds,
			onlyMe
		} as IGetActivitiesStatistics);
	}
}
