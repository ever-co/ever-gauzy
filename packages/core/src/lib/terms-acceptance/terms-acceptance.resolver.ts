import { Args, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { FeatureFlag, Public } from '@gauzy/common';
import { ITermsAcceptanceDocument } from '@gauzy/contracts';
import { FeatureFlagGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { TermsAcceptanceService } from './terms-acceptance.service';

/**
 * The published legal corpus over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: the one field below calls the same `TermsAcceptanceService.getRequiredDocuments` the
 * `GET /api/terms/required` route calls, and answers the same documents in the same order.
 *
 * **The field states no guard and no permission, and `@Public()` is stated rather than left implied.**
 * The delivered handler carries the platform's public marker and declares neither a guard nor a
 * permission, because the documents are read by the signup and invite-acceptance forms before any
 * account exists — a credential is not merely unnecessary here, it is usually absent. A guard or a
 * permission on this field would refuse a caller the REST route serves, which is the asymmetry the
 * two-protocol rule forbids.
 *
 * **The gate is the catalogue's, and it is the one thing this surface cannot express fully.**
 * `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the GraphQL endpoint and its
 * resolvers, and `FeatureFlagGuard` reads it from `FEATURE_METADATA` over the handler and then the
 * class — which is why it is stated once here, on the class. The capability it resolves is tenant-scoped:
 * `FeatureService.isFeatureEnabled` answers from the caller's own toggle rows when the request carries a
 * tenant, and falls back to the deployment's configured state when it does not — and `FEATURE_GRAPHQL` is
 * not a code that configuration names, so a request that carries no tenant scope resolves the capability
 * as disabled and is refused. That is exactly the caller this field exists for: one that has no account
 * yet and therefore no tenant. The field is therefore served only when the capability resolves for the
 * caller's scope, which is a narrower door than the route it mirrors, and the delivery has no way to
 * state otherwise — a field cannot be more open than the gate over it. Nothing narrower is stated on it
 * either, because a guard or a permission there would refuse a caller the REST route serves. Dropping
 * the gate to work around the limitation is not an option this delivery has: it would leave the whole
 * endpoint served to a deployment that switched the capability off, which is the defect the gate exists
 * to prevent. The limitation is therefore stated here rather than worked around.
 *
 * **There is one field and no more.** The controller declares one route and it writes nothing: the
 * corpus is read from the package that publishes it, so there is no row to count, no row to read back
 * by an identifier and nothing this resource could mutate. A connection would be machinery for a
 * problem this read does not have — the set is short, ordered by the corpus and complete — so the field
 * answers the list the route answers.
 */
@Resolver('TermsAcceptanceDocument')
@UseGuards(FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class TermsAcceptanceResolver {
	constructor(private readonly termsAcceptanceService: TermsAcceptanceService) {}

	/**
	 * The legal documents a new account must accept, as currently published.
	 *
	 * The reader is the one the route calls, handed the locale the route reads out of its query string.
	 * The answer is the corpus's own rendering, so a client that displays the returned title and digest
	 * and posts the same two values back is quoting text the server can verify — which is the whole
	 * point of publishing them rather than hard-coding them in the client.
	 *
	 * Nothing is stored and nothing is written: this field says which documents are current, and the
	 * acceptance a person gives is recorded by the flows that register them.
	 */
	@Query('termsAcceptanceDocuments')
	@Public()
	async termsAcceptanceDocuments(
		@Args('locale', { type: () => String, nullable: true }) locale?: string
	): Promise<ITermsAcceptanceDocument[]> {
		return this.termsAcceptanceService.getRequiredDocuments(locale);
	}
}
