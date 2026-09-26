import { UseGuards } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { ID as Id, IGetProfileActivity, IProfileActivity } from '@gauzy/contracts';
import { FeatureFlag } from '@gauzy/common';
import { FeatureFlagGuard, TenantPermissionGuard } from '../../shared/guards';
import { FEATURE_GRAPHQL } from '../../feature/graphql-feature.code';
import { StatisticService } from './statistic.service';

/**
 * The profile-activity summary over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: the one field below reaches the same `StatisticService.getProfileActivity` method that
 * `GET /timesheet/statistics/profile-activity` reaches, with the same request its validation pipe
 * produces.
 *
 * **It is a resolver of its own rather than a field of the statistics resolver, because the two
 * controllers state two different truths.** `ProfileActivityController` carries
 * `TenantPermissionGuard` and nothing else: it states no `@Permissions` at all, on the class or on its
 * one handler. `StatisticController` states a class-level permission list. One class-level statement
 * cannot be both, so each controller gets the resolver that mirrors it — and this one therefore states
 * **no permission anywhere**, which is the parity rather than an omission. A field that demanded a
 * permission would refuse a caller the REST route serves, and the two routes are one capability.
 *
 * **The answer is a computation over time logs, not a resource.** It is a summary of one employee's
 * authorized tracked time over a locally-bounded period: how many local days carried activity, how
 * long the activity lasted, and which days were the first and the last. The platform stores no such
 * row, so this surface has no connection, no node field, no count field and no write — the controller
 * serves one `GET` and nothing else, and one field states that one capability.
 *
 * **The scope the read enforces is the service's, and it is not turned into a permission here.** The
 * delivered method refuses the request when the caller has no tenant, when the named engagement does
 * not exist as an active, unarchived engagement of that organization, or when the caller may not view
 * that employee's profile — a manager may view the people they manage and nobody else. That check is
 * per request and per target, so restating it as a permission would be a second answer to the same
 * question and the wrong one in both directions; the field delegates to the read that enforces it.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so the field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on the field — and why it is
 * appended to the guard chain the route already carries rather than replacing any part of it.
 */
@Resolver()
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class ProfileActivityResolver {
	constructor(private readonly statisticService: StatisticService) {}

	/**
	 * One authorized employee's activity summary over a period of local calendar days.
	 *
	 * The same service method its route calls, with the same request. The two dates are date-only
	 * strings in `YYYY-MM-DD` rather than instants, because that is what the delivered read accepts and
	 * what it means: the period is a half-open span of *local* days — `startDate` inclusive, `endDate`
	 * exclusive — resolved against `timeZone`, so the same request answers the same days in New York and
	 * in Madrid while the instants behind them differ. A date-time is refused by the delivered
	 * validation, which is why this surface offers the shape the read answers rather than an instant it
	 * would reject.
	 *
	 * `organizationTeamId` is an access scope rather than a filter: the delivered read passes it to the
	 * policy that decides whether the caller may view this employee's profile at all, so stating a team
	 * can refuse the request where omitting it would serve it.
	 *
	 * `includeDaily` asks for the per-day breakdown. The delivered read answers it only when the member
	 * is exactly `true`, and the route's own default is `false`, so an absent argument here is the same
	 * statement as the route's default rather than a second one.
	 */
	@Query('timeTrackingProfileActivity')
	async timeTrackingProfileActivity(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('employeeId', { type: () => ID }) employeeId: Id,
		@Args('startDate', { type: () => String }) startDate: string,
		@Args('endDate', { type: () => String }) endDate: string,
		@Args('timeZone', { type: () => String }) timeZone: string,
		@Args('organizationTeamId', { type: () => ID, nullable: true }) organizationTeamId?: Id,
		@Args('includeDaily', { type: () => Boolean, nullable: true }) includeDaily?: boolean
	): Promise<IProfileActivity> {
		return await this.statisticService.getProfileActivity({
			organizationId,
			employeeId,
			startDate,
			endDate,
			timeZone,
			organizationTeamId,
			includeDaily
		} as IGetProfileActivity);
	}
}
