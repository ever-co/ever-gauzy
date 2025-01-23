import { CanActivate, ExecutionContext, Inject, Injectable, NotFoundException, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { FEATURE_METADATA } from '@gauzy/common';
import { FeatureEnum } from '@gauzy/contracts';
import { FeatureService } from './../../feature/feature.service';

/**
 * Feature enabled/disabled guard
 *
 * @returns
 */
@Injectable()
export class FeatureFlagGuard implements CanActivate {
	constructor(
		@Inject(CACHE_MANAGER) private cacheManager: Cache,
		private readonly _reflector: Reflector,
		private readonly featureFlagService: FeatureService
	) {}

	/**
	 * Determines if the current request can be activated based on feature flag metadata.
	 * @param context The execution context of the request.
	 * @returns A boolean indicating whether access is allowed.
	 */
	async canActivate(context: ExecutionContext) {
		// Retrieve permissions from metadata
		const targets: Array<Function | Type<any>> = [
			context.getHandler(), // Returns a reference to the handler (method) that will be invoked next in the request pipeline.
			context.getClass() // Returns the *type* of the controller class which the current handler belongs to.
		];

		// Retrieve metadata for a specified key for a specified set of features
		const flag = this._reflector.getAllAndOverride<FeatureEnum>(FEATURE_METADATA, targets);

		console.log('Guard: FeatureFlag checking', flag);

		const cacheKey = `featureFlag_${flag}`;

		const fromCache = await this.cacheManager.get<boolean | null>(cacheKey);

		let isEnabled: boolean;

		if (fromCache == null) {
			isEnabled = await this.featureFlagService.isFeatureEnabled(flag);
			await this.cacheManager.set(cacheKey, isEnabled);
		} else {
			isEnabled = fromCache;
		}

		// Check if the feature is enabled
		if (isEnabled) {
			console.log(`Guard: FeatureFlag ${flag} enabled`);
			return true;
		}

		// If the feature is not enabled, throw a NotFoundException
		const { method, url } = context.switchToHttp().getRequest();
		throw new NotFoundException(`Cannot ${method} ${url}`);
	}
}
