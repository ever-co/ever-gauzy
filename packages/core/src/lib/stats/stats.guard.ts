import { CanActivate, ExecutionContext, Injectable, NotFoundException, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_METADATA } from '@gauzy/common';
import { gauzyToggleFeatures } from '@gauzy/config';
import { FeatureEnum } from '@gauzy/contracts';

@Injectable()
export class StatsGuard implements CanActivate {
	public loggingEnabled: boolean = false;

	constructor(private readonly _reflector: Reflector) {}

	/**
	 * Determines if the current request can be activated based on feature flag metadata.
	 * @param context The execution context of the request.
	 * @returns A boolean indicating whether access is allowed.
	 */
	async canActivate(context: ExecutionContext): Promise<boolean> {
		// Retrieve permissions from metadata
		const targets: Array<Function | Type<any>> = [
			context.getHandler(), // Returns a reference to the handler (method) that will be invoked next in the request pipeline.
			context.getClass() // Returns the *type* of the controller class which the current handler belongs to.
		];

		// Retrieve metadata for a specified key for a specified set of features
		const featureFlag = this._reflector.getAllAndOverride<FeatureEnum>(FEATURE_METADATA, targets);

		// Check if the feature is enabled
		if (featureFlag) {
			// Check if the feature is enabled
			const isEnabled = !!gauzyToggleFeatures[featureFlag];

			if (this.loggingEnabled) {
				// Log the feature flag and its status
				console.log(`Guard: FeatureFlag ${featureFlag} is ${isEnabled ? 'enabled' : 'disabled'}`);
			}

			// If the feature is enabled, proceed with the request
			if (isEnabled) {
				return true;
			}
		}

		// If the feature is not enabled, throw a NotFoundException
		const { method, url } = context.switchToHttp().getRequest();
		throw new NotFoundException(`Cannot ${method} ${url}`);
	}
}
