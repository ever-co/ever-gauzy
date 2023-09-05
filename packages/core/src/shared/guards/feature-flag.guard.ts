import { FEATURE_METADATA } from '@gauzy/common';
import { FeatureEnum } from '@gauzy/contracts';
import {
	CanActivate,
	ExecutionContext,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureService } from './../../feature/feature.service';

/**
 * Feature enabled/disabled guard
 *
 * @returns
 */
@Injectable()
export class FeatureFlagGuard implements CanActivate {
	constructor(
		private readonly _reflector: Reflector,
		private readonly featureFlagService: FeatureService
	) { }

	async canActivate(context: ExecutionContext) {
		/*
		* Retrieve metadata for a specified key for a specified set of features
		*/
		const flag = this._reflector.getAllAndOverride<FeatureEnum>(FEATURE_METADATA, [
			context.getHandler(), // Returns a reference to the handler (method) that will be invoked next in the request pipeline.
			context.getClass(), // Returns the *type* of the controller class which the current handler belongs to.
		]);
		const isEnabled = await this.featureFlagService.isFeatureEnabled(flag);
		if (isEnabled) {
			return true;
		}

		const httpContext = context.switchToHttp();
		const request = httpContext.getRequest();
		throw new NotFoundException(`Cannot ${request.method} ${request.url}`);
	}
}
