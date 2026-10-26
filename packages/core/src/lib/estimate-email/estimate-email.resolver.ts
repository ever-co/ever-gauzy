import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { FindOptionsWhere } from 'typeorm';
import { IEstimateEmail } from '@gauzy/contracts';
import { FeatureFlag, Public } from '@gauzy/common';
import { FeatureFlagGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { EstimateEmail } from './estimate-email.entity';
import { EstimateEmailService } from './estimate-email.service';

/** The relations the delivered read will join, as `EstimateEmailRelation` declares them. */
export type EstimateEmailRelation = 'tenant' | 'organization';

/**
 * The estimate email over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: the field below calls the same `EstimateEmailService.validate` method the
 * `GET /api/estimate-email/validate` route calls, with the same criterion and the same relations.
 *
 * **The guard chain is the controller's, which is to say there is none to mirror.** The delivered
 * controller is `@Public()` and names no guard on its class and none on its handler, because the caller
 * is the recipient of an invitation who holds no account on this installation. The class here therefore
 * carries the gate and nothing else — a tenant or permission guard would refuse a caller the REST route
 * serves — and the field states the `@Public()` its own route states rather than leaving it off, because
 * the openness is this resource's decision and a decision should be readable as one rather than inferred
 * from a decorator that is not there. The platform's bootstrap registers an authentication guard for the
 * whole application, and it is that marker which exempts the delivered route from it; the same marker on
 * the field is what exempts this one.
 *
 * **The answer is the row, and a refusal stays a refusal.** The delivered read raises when the token does
 * not verify, when its claims name no row, or when the invitation has expired; the field lets that
 * failure reach the caller rather than answering a null row, because the two are different statements: a
 * forged token is a request the caller could not make correctly, and a client that could not tell it
 * apart from an expired invitation could not tell the recipient what to do next.
 *
 * **The gate is the one thing this surface cannot state fully.** `FEATURE_GRAPHQL` is the code the
 * commerce catalogue declares for the GraphQL endpoint and its resolvers, and every resolver this
 * platform ships carries it — there is no exception for an open route. It is tenant-scoped:
 * `FeatureFlagGuard` asks the feature service whether the code is enabled for the caller's scope and
 * resolves that from the request context. An invitation recipient carries no credential, so the guard is
 * asked about a scope with no tenant and the field is refused for the very caller the delivered read
 * exists for, while the REST route — which is not gated by that code — keeps serving them. Nothing
 * narrower is stated on the field either, because a guard or a permission there would refuse a caller the
 * route serves, and dropping the gate is not an option: it would leave the whole endpoint served to an
 * installation that switched the capability off. The platform records the same trade-off for its other
 * open resolvers, which are named on the gate's own allow-list; this delivery does not edit that list, so
 * the limitation is stated here rather than worked around.
 */
@Resolver('EstimateEmail')
@UseGuards(FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class EstimateEmailResolver {
	constructor(private readonly estimateEmailService: EstimateEmailService) {}

	/**
	 * The invitation one token names, verified and answered while it is still valid.
	 *
	 * The same service call the delivered validation route makes, with the same two members of the
	 * criterion — the address and the token — and the same relation list beside them. Everything the read
	 * decides is the service's: that the token's signature holds, that its claims name a row this
	 * installation holds, and that the invitation has not lapsed.
	 */
	@Query('estimateEmailValidation')
	@Public()
	async estimateEmailValidation(
		@Args('email', { type: () => String }) email: string,
		@Args('token', { type: () => String }) token: string,
		@Args('relations', { type: () => [String], nullable: true }) relations?: EstimateEmailRelation[]
	): Promise<IEstimateEmail> {
		return await this.estimateEmailService.validate(
			{ email, token } as FindOptionsWhere<EstimateEmail>,
			relations ?? []
		);
	}
}
