import {
	CanActivate,
	ExecutionContext,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureEnum, IAuthenticationFlagFeatures } from '@gauzy/contracts';
import { FEATURE_METADATA } from '../constants';

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
	FEATURE_LINKEDIN_LOGIN: featureEnabled(FeatureEnum.FEATURE_LINKEDIN_LOGIN),
};

/**
 * Feature enabled/disabled guard
 *
 * @returns
 */
@Injectable()
export class FeatureFlagEnabledGuard implements CanActivate {
	constructor(private readonly _reflector: Reflector) {}

	/**
	 *
	 * @param context
	 * @returns
	 */
	async canActivate(context: ExecutionContext) {
		/*
		* Retrieve metadata for a specified key for a specified set of features
		*/
		const flag = this._reflector.getAllAndOverride<FeatureEnum>(FEATURE_METADATA, [
			context.getHandler(), // Returns a reference to the handler (method) that will be invoked next in the request pipeline.
			context.getClass(), // Returns the *type* of the controller class which the current handler belongs to.
		]);
		if (!!flagFeatures[flag]) {
			return true;
		}

		/**
		* If the feature is not enabled, throw a NotFoundException.
		*/
		const httpContext = context.switchToHttp();
		const request = httpContext.getRequest();
		throw new NotFoundException(`Cannot ${request.method} ${request.url}`);
	}
}
