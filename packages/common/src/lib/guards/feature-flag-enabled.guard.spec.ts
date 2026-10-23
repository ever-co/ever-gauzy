import 'reflect-metadata';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureEnum } from '@gauzy/contracts';
import { FeatureFlag } from '../decorators/feature-flag.decorator';
import { FeatureFlagEnabledGuard, flagFeatures, requiredFeatureFlags } from './feature-flag-enabled.guard';

/**
 * `FeatureFlagEnabledGuard` requires every code a handler declares, or — when it declares none — every code
 * its class declares, against the deployment's configured login features.
 *
 * The configuration is read into `flagFeatures` when the module loads, so each case sets the entries it
 * depends on directly and restores them afterwards.
 */

const ON = FeatureEnum.FEATURE_EMAIL_PASSWORD_LOGIN;
const OTHER_ON = FeatureEnum.FEATURE_MAGIC_LOGIN;
const OFF = FeatureEnum.FEATURE_GITHUB_LOGIN;

@FeatureFlag(ON)
@FeatureFlag(OFF)
class TwoCodeController {
	/** Inherits both codes, one of which is off. */
	login() {
		return 'in';
	}

	/** States its own code, which replaces the class's two. */
	@FeatureFlag(OTHER_ON)
	magic() {
		return 'magic';
	}
}

@FeatureFlag(ON)
@FeatureFlag(OTHER_ON)
class BothOnController {
	login() {
		return 'in';
	}
}

@FeatureFlag(ON)
class OneCodeController {
	login() {
		return 'in';
	}
}

class UngatedController {
	login() {
		return 'in';
	}
}

/** An HTTP execution context for one handler. */
function httpContext(controller: Function, handler: string): ExecutionContext {
	return {
		getHandler: () => controller.prototype[handler],
		getClass: () => controller,
		getType: () => 'http',
		switchToHttp: () => ({ getRequest: () => ({ method: 'POST', url: `/auth/${handler}` }) })
	} as unknown as ExecutionContext;
}

/** A GraphQL execution context for one field. */
function graphqlContext(resolver: Function, field: string): ExecutionContext {
	return {
		getHandler: () => resolver.prototype[field],
		getClass: () => resolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

/** The refusal the guard raised, or undefined when it let the request through. */
async function refusal(context: ExecutionContext): Promise<unknown> {
	return new FeatureFlagEnabledGuard(new Reflector()).canActivate(context).then(
		() => undefined,
		(thrown) => thrown
	);
}

describe('FeatureFlagEnabledGuard — every declared code is required', () => {
	const saved = { ...flagFeatures };

	beforeEach(() => {
		Object.assign(flagFeatures, { [ON]: true, [OTHER_ON]: true, [OFF]: false });
	});

	afterEach(() => {
		Object.assign(flagFeatures, saved);
	});

	it('reads the handler’s codes when it states any, and the class’s otherwise', () => {
		const reflector = new Reflector();

		expect(requiredFeatureFlags(reflector, httpContext(TwoCodeController, 'login'))).toEqual([ON, OFF]);
		expect(requiredFeatureFlags(reflector, httpContext(TwoCodeController, 'magic'))).toEqual([OTHER_ON]);
		expect(requiredFeatureFlags(reflector, httpContext(OneCodeController, 'login'))).toEqual([ON]);
		expect(requiredFeatureFlags(reflector, httpContext(UngatedController, 'login'))).toEqual([]);
	});

	it('refuses when one of two class codes is off, over HTTP and over GraphQL', async () => {
		const overHttp = await refusal(httpContext(TwoCodeController, 'login'));
		expect(overHttp).toBeInstanceOf(NotFoundException);
		expect((overHttp as Error).message).toBe('Cannot POST /auth/login');

		const overGraphql = await refusal(graphqlContext(TwoCodeController, 'login'));
		expect(overGraphql).toBeInstanceOf(NotFoundException);
		expect((overGraphql as Error).message).toBe('Cannot query field login');
	});

	it('allows when every class code is on', async () => {
		expect(await refusal(httpContext(BothOnController, 'login'))).toBeUndefined();
	});

	it('lets a handler’s own code replace the class’s', async () => {
		// The class requires a code that is off; the handler states its own, which is on.
		expect(await refusal(httpContext(TwoCodeController, 'magic'))).toBeUndefined();
	});

	it('keeps a single code working exactly as before', async () => {
		expect(await refusal(httpContext(OneCodeController, 'login'))).toBeUndefined();

		flagFeatures[ON] = false;
		expect(await refusal(httpContext(OneCodeController, 'login'))).toBeInstanceOf(NotFoundException);
	});

	it('refuses a handler that declares no code', async () => {
		expect(await refusal(httpContext(UngatedController, 'login'))).toBeInstanceOf(NotFoundException);
	});
});
