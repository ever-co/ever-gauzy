import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { LanguagesEnum, PermissionsEnum } from '@gauzy/contracts';
import { FeatureFlag } from '@gauzy/common';
import { RequestContext } from '../core/context';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { EmailResetService } from './email-reset.service';
import { ResetEmailRequestDTO, VerifyEmailResetRequestDTO } from './dto';

/** The members `RequestEmailResetInput` declares in the schema. */
export interface IRequestEmailResetInput {
	email: string;
}

/** The members `VerifyEmailResetInput` declares in the schema. */
export interface IVerifyEmailResetInput {
	code: string;
}

/** What both delivered routes answer: the acknowledgement, and nothing about what was done. */
export interface IEmailResetOutcome {
	status: number;
	message: string;
}

/**
 * The email reset over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: both fields below call the same `EmailResetService` method the `/api/email-reset` routes call.
 *
 * **There is no read here**, and that is the delivery rather than a gap in it: the delivered controller
 * declares two `POST` routes and inherits none, so there is no list, no node and no count to mirror. The
 * service method that reads a reset record is reached by the verification itself; a root field reading
 * one would be a capability REST does not serve.
 *
 * **The guard chain and the permission pair are the controller's.** The class carries the two guards and
 * the pair the controller states on its class, and so does each field, because neither handler states a
 * permission of its own — both routes therefore run under both permissions, and a field that narrowed
 * itself to the one that reads as the obvious fit would give GraphQL a scope REST does not have.
 *
 * **The resolver's name labels the domain**, which is why it is the resource's own — the fields are root
 * fields, so the type they are registered under is `Mutation`, and the object type they answer is
 * `EmailResetOutcome`.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so both fields are behind the one capability.
 * `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the class, which
 * is why the gate is stated on the class rather than restated on each field — and why it is appended to
 * the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('EmailReset')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ORG_USERS_EDIT, PermissionsEnum.PROFILE_EDIT)
export class EmailResetResolver {
	constructor(private readonly emailResetService: EmailResetService) {}

	/**
	 * Asks for the address on the caller's own account to be changed.
	 *
	 * The delivered route hands the service the body it was given and the language its `language` header
	 * names; this field does the same. The subject is the credential's — the service reads the user from
	 * the request context — so the address is the whole of what a caller states, which is what the input
	 * carries and all it carries.
	 *
	 * The answer is the acknowledgement. The handler produces it in a `finally`, so it is answered for
	 * every outcome, including the ones the handler swallowed; a field that translated the swallow into
	 * an error would tell a caller something the REST route does not.
	 */
	@Mutation('requestEmailReset')
	@Permissions(PermissionsEnum.ORG_USERS_EDIT, PermissionsEnum.PROFILE_EDIT)
	async requestEmailReset(
		@Args('input') input: IRequestEmailResetInput
	): Promise<IEmailResetOutcome> {
		const request = { email: input.email } as ResetEmailRequestDTO;

		return (await this.emailResetService.requestChangeEmail(
			request,
			this.languageOfTheCaller()
		)) as IEmailResetOutcome;
	}

	/**
	 * Presents the code mailed to the new address.
	 *
	 * The same service method the delivered route calls, with the same member: the code, and nothing
	 * else. The account and the address it is being changed from are read from the credential by the
	 * service, so a caller cannot present a code against somebody else's attempt.
	 *
	 * The answer is the same acknowledgement, produced by the same `finally`.
	 */
	@Mutation('verifyEmailReset')
	@Permissions(PermissionsEnum.ORG_USERS_EDIT, PermissionsEnum.PROFILE_EDIT)
	async verifyEmailReset(@Args('input') input: IVerifyEmailResetInput): Promise<IEmailResetOutcome> {
		const request = { code: input.code } as VerifyEmailResetRequestDTO;

		return (await this.emailResetService.verifyCode(request)) as IEmailResetOutcome;
	}

	/**
	 * The language the delivered routes read off the `language` request header.
	 *
	 * `RequestContext.getLanguageCode()` reads that header from the request the bootstrap mounted the
	 * context on — it mounts one on the GraphQL endpoint as well as on the prefixed routes — and answers
	 * English when none was stated, which is the default the delivered language decorator applies. So a
	 * caller asking the same question over either protocol is mailed the same message.
	 */
	private languageOfTheCaller(): LanguagesEnum {
		return RequestContext.getLanguageCode();
	}
}
