import { Route } from '@angular/router';
import { PageRouteRegistryService, registrationEnabledGuard } from '@gauzy/ui-core/core';
import { createPublicLayoutRoutes } from './public-layout.routes';

/**
 * #5784 / #7821: `/share/workspace/create` signs up a new account (register, then a new tenant), so it closes with
 * the operator's registration switches exactly like `/auth/register`. Signing in to an existing workspace does not.
 */
describe('public layout routes — registration switch', () => {
	const [shell] = createPublicLayoutRoutes({} as PageRouteRegistryService);
	const workspace = shell.children?.find((route: Route) => route.path === 'workspace');
	const child = (path: string) => workspace?.children?.find((route: Route) => route.path === path);

	it('guards the create-workspace sign-up with the registration switch', () => {
		expect(child('create')?.canActivate).toEqual([registrationEnabledGuard]);
	});

	it.each(['signin', 'find'])('leaves workspace %s open', (path) => {
		expect(child(path)).toBeDefined();
		expect(child(path)?.canActivate ?? []).not.toContain(registrationEnabledGuard);
	});
});
