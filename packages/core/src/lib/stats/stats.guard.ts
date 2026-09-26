import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { gauzyToggleFeatures } from '@gauzy/config';
import { requiredFeatureFlags } from '@gauzy/common';
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
		// Every code the handler states, or the class's when the handler states none: `@FeatureFlag`
		// accumulates stacked decorators, so reading one value with `getAllAndOverride` would check only
		// whichever of them happened to be stored last.
		const featureFlags = requiredFeatureFlags(this._reflector, context);

		// A route with no flag at all is refused, as before: this guard exists to gate on one.
		const isEnabled =
			featureFlags.length > 0 && featureFlags.every((featureFlag: FeatureEnum) => !!gauzyToggleFeatures[featureFlag]);

		if (this.loggingEnabled) {
			console.log(`Guard: FeatureFlag(s) ${featureFlags.join(', ') || '(none)'} ${isEnabled ? 'enabled' : 'disabled'}`);
		}

		if (isEnabled) {
			return true;
		}

		// **The refusal is answered per transport.** `globalStats` runs this guard over GraphQL too, and
		// there `switchToHttp().getRequest()` is not a request at all, so reading `method` and `url` off it
		// threw a `TypeError` — a disabled capability answered 500 instead of the 404 the route answers.
		if (context.getType<'http' | 'graphql'>() === 'graphql') {
			const info = context.getArgByIndex?.(3) as { fieldName?: string } | undefined;

			throw new NotFoundException(
				info?.fieldName ? `Cannot query field ${info.fieldName}` : 'The requested capability is not enabled.'
			);
		}

		const { method, url } = context.switchToHttp().getRequest() ?? {};
		throw new NotFoundException(`Cannot ${method} ${url}`);
	}
}
