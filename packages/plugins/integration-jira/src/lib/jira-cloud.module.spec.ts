import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { JiraAuthorizationController } from './jira-authorization.controller';
import { JiraCloudController } from './jira-cloud.controller';
import { JiraCloudModule } from './jira-cloud.module';
import { JiraWebhookController } from './jira-webhook.controller';
import { getControllerClass } from './jira.controller';

type Handler = (...args: unknown[]) => unknown;
type ControllerClass = abstract new (...args: never[]) => unknown;

/** The routes a controller declares, as `VERB path` under its own prefix. */
function routesOf(controller: ControllerClass): string[] {
	const prototype = controller.prototype as Record<string, Handler>;
	return Object.getOwnPropertyNames(prototype)
		.filter((name) => name !== 'constructor' && typeof prototype[name] === 'function' && Reflect.hasMetadata(PATH_METADATA, prototype[name]))
		.map((name) => `${RequestMethod[Reflect.getMetadata(METHOD_METADATA, prototype[name]) as number]} ${Reflect.getMetadata(PATH_METADATA, prototype[name])}`);
}

/**
 * Express answers a request with the first route registered that matches, and Nest registers controllers in the
 * module's order: `GET /callback` (public, the OAuth return) would be taken by `GET /:integrationId` (guarded,
 * UUID-checked) if the management controller came first, and no connection could complete.
 */
describe('JiraCloudModule controllers', () => {
	const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, JiraCloudModule) as ControllerClass[];

	it('registers the callback and the webhook before the id routes', () => {
		expect(controllers).toContain(JiraCloudController);
		expect(controllers.indexOf(JiraAuthorizationController)).toBeGreaterThanOrEqual(0);
		expect(controllers.indexOf(JiraAuthorizationController)).toBeLessThan(controllers.indexOf(JiraCloudController));
		expect(controllers.indexOf(JiraWebhookController)).toBeGreaterThanOrEqual(0);
		expect(controllers.indexOf(JiraWebhookController)).toBeLessThan(controllers.indexOf(JiraCloudController));
	});

	it('keeps the routes that collide under one prefix: a fixed GET /callback and a parameter GET /:integrationId', () => {
		expect(Reflect.getMetadata(PATH_METADATA, JiraAuthorizationController)).toBe(Reflect.getMetadata(PATH_METADATA, JiraCloudController));
		expect(routesOf(JiraAuthorizationController)).toContain('GET /callback');
		expect(routesOf(JiraCloudController)).toContain('GET /:integrationId');
	});
});

/**
 * The Connect descriptor routes (`IntegrationJiraPlugin`, always loaded) share the `/integration/jira` prefix and are
 * registered first. None of the sync's routes is one of them, so neither takes the other's requests.
 */
describe('the Connect descriptor routes beside the sync', () => {
	const Hook = getControllerClass({ path: 'integration/jira', config: {} } as never) as ControllerClass;

	it('keeps every route the Connect app answers', () => {
		expect(routesOf(Hook).sort()).toEqual(
			['GET atlassian-connect.json', 'POST installed', 'POST issue-created', 'POST issue-deleted', 'POST issue-updated', 'POST uninstalled'].sort()
		);
	});

	it('declares no route the Connect app declares, under the same prefix', () => {
		const sync = [JiraAuthorizationController, JiraWebhookController, JiraCloudController].flatMap((controller) => {
			const prefix = String(Reflect.getMetadata(PATH_METADATA, controller)).replace(/^\/+/, '');
			return routesOf(controller).map((route) => {
				const [verb, path] = route.split(' ');
				return `${verb} ${`${prefix}/${path.replace(/^\/+/, '')}`.replace(/\/+$/, '')}`;
			});
		});
		const hook = routesOf(Hook).map((route) => {
			const [verb, path] = route.split(' ');
			return `${verb} integration/jira/${path}`;
		});
		expect(sync.filter((route) => hook.includes(route))).toEqual([]);
		// The sync's only single-segment parameter routes are the id routes, which the Connect app's fixed names precede.
		expect(sync.filter((route) => /^(GET|POST) integration\/jira\/[^/]+$/.test(route)).sort()).toEqual(['GET integration/jira/:integrationId', 'GET integration/jira/callback', 'GET integration/jira/status']);
	});
});
