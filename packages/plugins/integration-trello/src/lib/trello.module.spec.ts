import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { TrelloController } from './trello.controller';
import { TrelloModule } from './trello.module';
import { TrelloWebhookController } from './trello-webhook.controller';

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
 * module's order: the public webhook receiver comes before the management controller, whose parameter routes
 * come after its fixed ones (`/status`, `/install/state`, `/connect`).
 */
describe('TrelloModule controllers', () => {
	const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, TrelloModule) as ControllerClass[];

	it('registers the webhook receiver before the management routes', () => {
		expect(controllers.indexOf(TrelloWebhookController)).toBeGreaterThanOrEqual(0);
		expect(controllers.indexOf(TrelloWebhookController)).toBeLessThan(controllers.indexOf(TrelloController));
	});

	it('keeps the webhook under its own prefix, with the HEAD check Trello sends first', () => {
		expect(Reflect.getMetadata(PATH_METADATA, TrelloWebhookController)).toBe('/integration/trello/webhook');
		expect(routesOf(TrelloWebhookController)).toEqual(expect.arrayContaining(['HEAD /:mappingId', 'POST /:mappingId']));
		expect(routesOf(TrelloController)).toEqual(expect.arrayContaining(['POST /connect', 'POST /install/state', 'GET /:integrationId']));
	});
});
