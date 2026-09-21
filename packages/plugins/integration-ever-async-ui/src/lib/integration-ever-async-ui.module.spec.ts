import { Injector, runInInjectionContext } from '@angular/core';
import { LoggerService, NavMenuBuilderService, PageRouteRegistryService } from '@gauzy/ui-core/core';
import { PLUGIN_DEFINITION } from '@gauzy/plugin-ui';
import { IntegrationEverAsyncUiModule } from './integration-ever-async-ui.module';

// Exercise the actual shared registry and registration helper without loading
// the entire application barrel or unrelated plugin services.
jest.mock(
	'@gauzy/ui-core/core',
	() => ({
		...jest.requireActual('../../../../ui-core/core/src/lib/services/page/page-route-registry.service'),
		LoggerService: class {},
		NavMenuBuilderService: class {},
		PermissionsGuard: class {}
	}),
	{ virtual: true }
);
jest.mock(
	'@gauzy/plugin-ui',
	() => ({
		...jest.requireActual('../../../../plugin-ui/src/lib/plugin-ui.helper'),
		...jest.requireActual('../../../../plugin-ui/src/lib/plugin-ui.types')
	}),
	{ virtual: true }
);
jest.mock('@gauzy/contracts', () => ({ PermissionsEnum: { INTEGRATION_VIEW: 'view' } }), { virtual: true });
jest.mock('./components/ever-async-connect/ever-async-connect.component', () => ({
	EverAsyncConnectComponent: class {}
}));
jest.mock('./integration-ever-async.layout.component', () => ({ IntegrationEverAsyncLayoutComponent: class {} }));

describe('IntegrationEverAsyncUiModule registration', () => {
	const loadChildren = () => Promise.resolve(IntegrationEverAsyncUiModule);
	const definition = {
		id: 'integration-ever-async',
		routes: [{ location: 'integrations-sections', path: 'ever-async', loadChildren }]
	};

	function moduleFor(registry: PageRouteRegistryService) {
		const injector = Injector.create({
			providers: [
				{ provide: LoggerService, useValue: { withContext: () => ({ log: jest.fn() }) } },
				{ provide: NavMenuBuilderService, useValue: {} },
				{ provide: PageRouteRegistryService, useValue: registry },
				{ provide: PLUGIN_DEFINITION, useValue: definition }
			]
		});
		return runInInjectionContext(injector, () => new IntegrationEverAsyncUiModule());
	}

	it('can bootstrap again after unloading without duplicating its route', () => {
		const registry = new PageRouteRegistryService();
		const first = moduleFor(registry);
		first.ngOnPluginBootstrap();
		first.ngOnPluginDestroy();
		const reloaded = moduleFor(registry);
		expect(() => reloaded.ngOnPluginBootstrap()).not.toThrow();
		expect(registry.getPageLocationRoutes('integrations-sections')).toHaveLength(1);
		expect(registry.getPageLocationRoutes('integrations-sections')[0].loadChildren).toBe(loadChildren);
	});

	it('still rejects an unrelated route occupying the same path', () => {
		const registry = new PageRouteRegistryService();
		registry.registerPageRoute({
			location: 'integrations-sections',
			path: 'ever-async',
			loadChildren: () => Promise.resolve([])
		});
		expect(() => moduleFor(registry).ngOnPluginBootstrap()).toThrow(/already been registered/);
	});
});
