import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { IEmailCheckResponse } from '@gauzy/contracts';
import { FeatureFlag, Public } from '@gauzy/common';
import { ApiKeyAuthGuard } from '../shared/guards/api-key-auth.guard';
import { FeatureFlagGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { EmailCheckService } from './email-check.service';

/**
 * The email check over GraphQL.
 *
 * REST and GraphQL are two views of the same operation, so this resolver owns no business logic of its
 * own: the field below calls the same `EmailCheckService.doesEmailExist` method the
 * `POST /api/auth/email-check` route calls, with the address the route reads out of its body.
 *
 * **The guards are the controller's.** The delivered controller carries `ApiKeyAuthGuard` on its class —
 * a machine caller presents an identifier and a secret in the request headers rather than a session — so
 * the class here carries the same guard beside the gate. That guard reads the request from a GraphQL
 * execution context as well as an HTTP one, and it is what establishes the tenant the gate then resolves
 * the capability against, which is why the two are stated in that order.
 *
 * **The openness is the handler's.** The delivered handler carries the platform's public marker, which is
 * what exempts the route from the authentication guard the application registers for every route; the
 * field states the same marker, so a caller holding a key pair and no session is served by both
 * protocols. The field states it rather than leaving it implied, because the openness is this resource's
 * decision and a decision should be readable as one.
 *
 * **No permission is stated, because the controller states none.** What authorises a call here is the key
 * pair: the guard validates it, establishes the tenant from it, and consults no role permission — so a
 * permission on this field would demand a grant the delivered route never asks for.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so the field is behind the one capability.
 * `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the class, which
 * is why the gate is stated on the class rather than restated on the field — and because the API-key
 * guard runs first, the scope it resolves against is the tenant the key belongs to rather than a scope
 * with no tenant.
 */
@Resolver('EmailCheckResult')
@UseGuards(ApiKeyAuthGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class EmailCheckResolver {
	constructor(private readonly emailCheckService: EmailCheckService) {}

	/**
	 * Whether an account with the given address exists.
	 *
	 * The same service call the delivered route makes, with the same answer shape: the service counts the
	 * rows whose address matches and the field answers whether there were any. Nothing about the account
	 * is read and nothing about it is answered, which is the operation's own boundary rather than a
	 * narrowing here.
	 */
	@Query('emailCheck')
	@Public()
	async emailCheck(@Args('email', { type: () => String }) email: string): Promise<IEmailCheckResponse> {
		const exists = await this.emailCheckService.doesEmailExist(email);

		return { exists };
	}
}
