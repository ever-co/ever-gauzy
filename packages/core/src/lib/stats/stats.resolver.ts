import { UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag, Public } from '@gauzy/common';
import { FeatureEnum } from '@gauzy/contracts';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { FeatureFlagGuard } from '../shared/guards';
import { StatsGuard } from './stats.guard';
import { StatsService } from './stats.service';
import { GlobalStats } from './stats.types';

/**
 * The platform statistics over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: the one field below reaches the same `StatsService.getGlobalStats` the
 * `GET /api/stats/global` route reaches, and answers the document that call builds.
 *
 * **There is one field and no more, and there is no mutation at all.** The controller serves one route
 * and no route of it writes — the resource has no table, no identifier and no lifecycle of its own —
 * so there is no node field, no count field and nothing between them: each would be a capability with
 * no REST route behind it, and an installation that wants a subset of the totals reads the members it
 * wants from the document rather than narrowing a list that does not exist.
 *
 * **The guard chain and the permission are the controller's, and the controller's permission is
 * none.** `StatsController` carries the platform's `Public()` marker and declares no permission, so
 * this resolver states `@Public()` and no `@Permissions`: a permission here would demand a grant no
 * route asks for, and stating the marker rather than leaving it off is what makes the openness
 * readable as this resource's decision — the aggregate is the installation's own total, published by
 * an operator who asked for it. The route's own guard, `StatsGuard`, is carried by the field on the
 * same terms: it is the guard the HTTP route runs under, and it reads the same capability code the
 * field states.
 *
 * **The gate is the catalogue's, with one statement of the route's own on top of it.** The class
 * carries `FEATURE_GRAPHQL` — the code the commerce catalogue declares for the GraphQL endpoint and
 * its resolvers — so the endpoint's switch reaches this resolver like every other. The field states
 * the route's own code, `FEATURE_OPEN_STATS`, because that is the capability the delivered route is
 * behind and a field may not be wider than the route it mirrors: `FeatureFlagGuard` reads a field's
 * own statement before the class's, so what the field is gated by is the route's switch, and the code
 * is not restated anywhere — the field states the catalogue's own enum member.
 *
 * Both guards read that one code, so they agree: `FeatureFlagGuard` resolves it through the tenant's
 * catalogue and falls back to the deployment's configured toggle, which is exactly the answer
 * `StatsGuard` reads from the configuration directly. The order matters and is the reason the route's
 * HTTP-shaped refusal never reaches a GraphQL caller: the class's guards run before the field's, so a
 * capability that is switched off is refused by `FeatureFlagGuard` as `Cannot query field globalStats`
 * — the way a disabled capability's fields are refused everywhere on this endpoint — rather than by a
 * guard whose refusal names an HTTP method and a URL a GraphQL request does not have.
 */
@Resolver('GlobalStats')
@Public()
@UseGuards(FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class StatsResolver {
	constructor(private readonly statsService: StatsService) {}

	/**
	 * The platform's own aggregates.
	 *
	 * The read is the delivered route's own call, with no argument and no narrowing: the service
	 * aggregates the records the other domains own — tenants, users, employees, organizations, teams,
	 * tasks, invoices, payments and tracked time — and answers one document. Nothing here rescales,
	 * rounds or reformats a member: the amounts travel as the platform's own aggregations produced
	 * them, which is what makes a client's arithmetic and the platform's agree.
	 */
	@Query('globalStats')
	@UseGuards(StatsGuard)
	@FeatureFlag(FeatureEnum.FEATURE_OPEN_STATS)
	async globalStats(): Promise<GlobalStats> {
		return await this.statsService.getGlobalStats();
	}
}
