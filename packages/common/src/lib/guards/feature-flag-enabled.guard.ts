import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_METADATA } from '@gauzy/constants';
import { FeatureEnum, IAuthenticationFlagFeatures } from '@gauzy/contracts';
import { featureFlagsOf, FeatureFlagMetadata } from '../decorators/feature-flag.decorator';

/**
 * Check if a specific feature is enabled based on the environment variable.
 *
 * @param feature - The feature key to check.
 * @returns True if the feature is enabled, otherwise false.
 */
const featureEnabled = (feature: Extract<keyof IAuthenticationFlagFeatures, string>) => {
	return process.env[feature] !== 'false';
};

/**
 * Object containing flag features for authentication.
 */
export const flagFeatures: IAuthenticationFlagFeatures = {
	/** Flag indicating whether email/password login is enabled. */
	FEATURE_EMAIL_PASSWORD_LOGIN: featureEnabled(FeatureEnum.FEATURE_EMAIL_PASSWORD_LOGIN),

	/** Flag indicating whether magic login is enabled. */
	FEATURE_MAGIC_LOGIN: featureEnabled(FeatureEnum.FEATURE_MAGIC_LOGIN),

	/** Flag indicating whether GitHub login is enabled. */
	FEATURE_GITHUB_LOGIN: featureEnabled(FeatureEnum.FEATURE_GITHUB_LOGIN),

	/** Flag indicating whether Facebook login is enabled. */
	FEATURE_FACEBOOK_LOGIN: featureEnabled(FeatureEnum.FEATURE_FACEBOOK_LOGIN),

	/** Flag indicating whether Google login is enabled. */
	FEATURE_GOOGLE_LOGIN: featureEnabled(FeatureEnum.FEATURE_GOOGLE_LOGIN),

	/** Flag indicating whether Twitter login is enabled. */
	FEATURE_TWITTER_LOGIN: featureEnabled(FeatureEnum.FEATURE_TWITTER_LOGIN),

	/** Flag indicating whether Microsoft login is enabled. */
	FEATURE_MICROSOFT_LOGIN: featureEnabled(FeatureEnum.FEATURE_MICROSOFT_LOGIN),

	/** Flag indicating whether LinkedIn login is enabled. */
	FEATURE_LINKEDIN_LOGIN: featureEnabled(FeatureEnum.FEATURE_LINKEDIN_LOGIN)
};

/**
 * The feature codes a handler requires: every code declared on the handler, or — when the handler declares
 * none — every code declared on its class.
 *
 * `@FeatureFlag` accumulates, so a target may declare several codes; this is the one reading of that
 * metadata both feature guards share, and the reason neither reads it with `getAllAndOverride` any more:
 * that call answers the first single value it finds, so of a class gated on `FEATURE_GRAPHQL` and on its
 * own capability it saw one code and the other gate never ran.
 *
 * The precedence is the one `getAllAndOverride` always applied — the handler before the class — at the
 * level of the whole set: a handler that states its own codes is gated on those instead of its class's,
 * which is what a handler-level `@FeatureFlag` has always meant.
 *
 * @param reflector The reflector the guard was given.
 * @param context The execution context of the request being guarded.
 * @returns The codes that must all be enabled; empty when neither the handler nor the class declares one.
 */
export function requiredFeatureFlags(reflector: Reflector, context: ExecutionContext): FeatureEnum[] {
	const declaredOnHandler = featureFlagsOf(reflector.get<FeatureFlagMetadata>(FEATURE_METADATA, context.getHandler()));

	if (declaredOnHandler.length > 0) {
		return declaredOnHandler;
	}

	return featureFlagsOf(reflector.get<FeatureFlagMetadata>(FEATURE_METADATA, context.getClass()));
}

/**
 * Feature enabled/disabled guard
 *
 * Allows a request only when every feature code the handler requires (see {@link requiredFeatureFlags}) is
 * enabled in the deployment's configuration. A handler that requires no code is refused, as it always was:
 * the guard exists to open a route for an enabled feature, and with no feature named there is nothing it
 * could have found enabled.
 */
@Injectable()
export class FeatureFlagEnabledGuard implements CanActivate {
	constructor(private readonly _reflector: Reflector) {}

	/**
	 * @param context The execution context of the request.
	 * @returns True when every required feature code is enabled.
	 * @throws NotFoundException when one of them is not, or when none is declared.
	 */
	async canActivate(context: ExecutionContext) {
		const flags = requiredFeatureFlags(this._reflector, context);

		if (flags.length > 0 && flags.every((flag) => !!flagFeatures[flag])) {
			return true;
		}

		/**
		 * If the feature is not enabled, throw a NotFoundException — naming what was refused in the terms
		 * of the context the request arrived through. On a GraphQL execution context `switchToHttp()` hands
		 * back the resolver's root value rather than a request, so reading `method` and `url` from it named
		 * nothing; the field being resolved is what a GraphQL caller can recognise.
		 */
		if (context.getType<'http' | 'graphql'>() === 'graphql') {
			const info = context.getArgByIndex?.(3) as { fieldName?: string } | undefined;

			throw new NotFoundException(
				info?.fieldName ? `Cannot query field ${info.fieldName}` : 'The requested capability is not enabled.'
			);
		}

		const request = context.switchToHttp().getRequest();
		const { method, url } = request ?? {};

		throw new NotFoundException(`Cannot ${method} ${url}`);
	}
}
