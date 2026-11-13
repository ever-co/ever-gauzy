import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { LinearAuthorizationController } from './linear-authorization.controller';
import { LinearController } from './linear.controller';
import { LinearModule } from './linear.module';
import { LinearWebhookController } from './linear-webhook.controller';

type Handler = (...args: unknown[]) => unknown;
type ControllerClass = abstract new (...args: never[]) => unknown;

/** The routes a controller declares, as `VERB path` under its own prefix. */
function routesOf(controller: ControllerClass): string[] {
	const prototype = controller.prototype as Record<string, Handler>;
	return Object.getOwnPropertyNames(prototype)
		.filter((name) => typeof prototype[name] === 'function' && Reflect.hasMetadata(PATH_METADATA, prototype[name]))
		.map((name) => `${RequestMethod[Reflect.getMetadata(METHOD_METADATA, prototype[name]) as number]} ${Reflect.getMetadata(PATH_METADATA, prototype[name])}`);
}

/**
 * Express answers a request with the first route registered that matches, and Nest registers controllers in the
 * module's order: `GET /callback` (public, the OAuth return) would be taken by `GET /:integrationId` (guarded,
 * UUID-checked) if the management controller came first, and no connection could complete.
 */
describe('LinearModule controllers', () => {
	const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, LinearModule) as ControllerClass[];

	it('registers the callback and the webhook before the id routes', () => {
		expect(controllers).toContain(LinearController);
		expect(controllers.indexOf(LinearAuthorizationController)).toBeGreaterThanOrEqual(0);
		expect(controllers.indexOf(LinearAuthorizationController)).toBeLessThan(controllers.indexOf(LinearController));
		expect(controllers.indexOf(LinearWebhookController)).toBeGreaterThanOrEqual(0);
		expect(controllers.indexOf(LinearWebhookController)).toBeLessThan(controllers.indexOf(LinearController));
	});

	it('keeps the routes that collide under one prefix: a fixed GET /callback and a parameter GET /:integrationId', () => {
		expect(Reflect.getMetadata(PATH_METADATA, LinearAuthorizationController)).toBe(Reflect.getMetadata(PATH_METADATA, LinearController));
		expect(routesOf(LinearAuthorizationController)).toContain('GET /callback');
		expect(routesOf(LinearController)).toContain('GET /:integrationId');
	});
});
