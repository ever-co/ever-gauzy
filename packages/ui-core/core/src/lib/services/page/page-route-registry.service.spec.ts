import { Routes } from '@angular/router';
import { PAGE_SECTIONS_LOCATION, PageRouteRegistryService } from './page-route-registry.service';
import { PageRouteRegistryConfig } from './page-route-registry.types';

/**
 * The navigation-target contract: everything `registerPageRoute` ACCEPTS as a
 * target, `getPageLocationRoutes` must CARRY onto the generated route. A route
 * accepted-but-dropped has no target at all, and Angular then throws NG04014
 * while recognizing the lazy parent config it ends up in — which silently kills
 * every navigation into that whole subtree at click time.
 */
describe('PageRouteRegistryService — navigation-target contract', () => {
	let service: PageRouteRegistryService;

	beforeEach(() => {
		service = new PageRouteRegistryService();
	});

	const register = (config: Partial<PageRouteRegistryConfig>): void =>
		service.registerPageRoute({ location: PAGE_SECTIONS_LOCATION, ...config } as PageRouteRegistryConfig);

	it('rejects a registration with no navigation target at all (the NG04014 guard)', () => {
		expect(() => register({ path: 'jobs' })).toThrow(/navigation target/);
	});

	it('accepts a target supplied through the `route` passthrough object', () => {
		expect(() => register({ path: 'jobs', route: { redirectTo: 'employees' } })).not.toThrow();
	});

	it('carries a top-level redirectTo onto the generated route', () => {
		register({ path: 'legacy-jobs', redirectTo: 'jobs' });

		const [route] = service.getPageLocationRoutes(PAGE_SECTIONS_LOCATION);
		expect(route.redirectTo).toBe('jobs');
	});

	it('carries top-level children onto the generated route', () => {
		const children: Routes = [{ path: 'board', redirectTo: 'list' }];
		register({ path: 'jobs', children });

		const [route] = service.getPageLocationRoutes(PAGE_SECTIONS_LOCATION);
		expect(route.children).toBe(children);
	});

	it('carries loadComponent onto the generated route (the Settings regression)', () => {
		const loadComponent = () => Promise.resolve(class {});
		register({ path: 'jobs', loadComponent: loadComponent as never });

		const [route] = service.getPageLocationRoutes(PAGE_SECTIONS_LOCATION);
		expect(route.loadComponent).toBe(loadComponent);
	});

	it('lets a component-ish target take precedence over redirectTo in the else-chain', () => {
		const component = class {};
		register({ path: 'jobs', component: component as never, redirectTo: 'unused' });

		const [route] = service.getPageLocationRoutes(PAGE_SECTIONS_LOCATION);
		expect(route.component).toBe(component);
		expect(route.redirectTo).toBeUndefined();
	});
});
