// cspell:ignore ɵinj
/*
 * The PDF viewer reaches pdfjs through `import.meta.url`, which the CommonJS test runtime cannot load; it is
 * a leaf of the Documents module this spec only reads the route table of.
 */
jest.mock('../../../../../packages/plugins/docs-ui/src/lib/components/preview/pdf-viewer.component', () => {
	const { Component } = jest.requireActual('@angular/core');
	@Component({ selector: 'gz-docs-pdf-viewer', template: '', standalone: false })
	class PdfViewerComponent {}
	return { PdfViewerComponent };
});

// The settings shell's email-templates editor: the package's `main` is its ESM rollup config.
jest.mock('ngx-ace-editor-wrapper', () => {
	const { NgModule } = jest.requireActual('@angular/core');
	@NgModule({})
	class AceEditorModule {}
	return { AceEditorModule };
});

import { Provider, Type } from '@angular/core';
import { LoadChildrenCallback, Route, Routes, ROUTES } from '@angular/router';
import { BaseEntityEnum, DocumentKindEnum } from '@gauzy/contracts';
import { ENTITY_LINKS, PageRouteRegistryService } from '@gauzy/ui-core/core';
import { NotFoundComponent } from '@gauzy/ui-core/shared';
import { DOCS_PAGE_ROUTE } from '@gauzy/plugin-docs-ui';
// Not part of the plugin's public barrel: the plugin registers it itself at bootstrap.
import { JOB_PROPOSAL_SALES_ROUTE } from '../../../../../packages/plugins/job-proposal-ui/src/lib/proposal/job-proposal.routes';
import { getPagesRoutes } from './pages.routes';

/**
 * Every link a sidebar favorite can open must be a page the app really serves (handover §4.P: "a click on
 * a favorite must open the record full-width as a real routed page"). Before this spec, several targets
 * (`/pages/organization/vendors/edit/:id`, `/pages/organization/sprints/edit/:id`, `/pages/tasks/views/:id`,
 * `/pages/organization/edit/:id`, …) matched nothing and fell through to the `**` "not found" page.
 *
 * The check runs the real route configuration: `getPagesRoutes()` with the plugin routes the favorites can
 * point into, and every lazy `loadChildren` on the way is LOADED and its `ROUTES` read from the NgModule's
 * injector definition, exactly what the router itself registers. Matching follows the router's rules for
 * the shapes these route tables use (literal and `:param` segments, `''` prefix routes, children, redirects
 * are not a destination); landing on the `**` catch-all counts as a failure.
 */

const ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const PROJECT_ID = 'bbbbbbbb-2222-4222-8222-222222222222';

/** The record shapes a link builder may receive from the favorite details endpoint. */
const RECORDS: Partial<Record<BaseEntityEnum, Record<string, unknown>[]>> = {
	[BaseEntityEnum.Document]: [
		{ id: ID, kind: DocumentKindEnum.PAGE },
		{ id: ID, kind: DocumentKindEnum.FOLDER },
		{ id: ID, kind: DocumentKindEnum.FILE },
		{ id: ID }
	],
	[BaseEntityEnum.Invoice]: [
		{ id: ID, isEstimate: false },
		{ id: ID, isEstimate: true }
	],
	[BaseEntityEnum.OrganizationSprint]: [{ id: ID, projectId: PROJECT_ID }, { id: ID }],
	[BaseEntityEnum.OrganizationProjectModule]: [{ id: ID, projectId: PROJECT_ID }, { id: ID }]
};

/** Plugin routes favorites link into, registered the way their plugins register them at bootstrap. */
function createRegistry(): PageRouteRegistryService {
	const registry = new PageRouteRegistryService();
	registry.registerPageRoute(DOCS_PAGE_ROUTE as any);
	registry.registerPageRoute(JOB_PROPOSAL_SALES_ROUTE);
	return registry;
}

/** `ROUTES` an NgModule (and the modules it imports) contributes, as the router collects them. */
function routesOfModule(module: Type<unknown>, registry: PageRouteRegistryService, seen = new Set<unknown>()): Route[] {
	if (!module || seen.has(module)) {
		return [];
	}
	seen.add(module);
	const def = (module as any).ɵinj as { imports?: unknown[]; providers?: unknown[] } | undefined;
	if (!def) {
		return [];
	}
	const routes: Route[] = [];
	const fromProviders = (providers: unknown[] = []) => {
		for (const provider of (providers as unknown[]).flat(Infinity) as Provider[]) {
			const p = provider as { provide?: unknown; useValue?: Routes; useFactory?: (...args: unknown[]) => Routes };
			if (p?.provide !== ROUTES) {
				continue;
			}
			const value = p.useValue ?? p.useFactory?.(registry);
			routes.push(...(((value ?? []) as unknown[]).flat(Infinity) as Route[]));
		}
	};
	fromProviders(def.providers);
	for (const imported of (def.imports ?? []).flat(Infinity) as unknown[]) {
		const withProviders = imported as { ngModule?: Type<unknown>; providers?: unknown[] };
		if (withProviders?.ngModule) {
			fromProviders(withProviders.providers);
			routes.push(...routesOfModule(withProviders.ngModule, registry, seen));
		} else {
			routes.push(...routesOfModule(imported as Type<unknown>, registry, seen));
		}
	}
	return routes;
}

async function childrenOf(route: Route, registry: PageRouteRegistryService): Promise<Route[] | null> {
	if (route.children) {
		return route.children;
	}
	if (route.loadChildren) {
		const loaded = await (route.loadChildren as LoadChildrenCallback)();
		const value = (loaded as { default?: unknown })?.default ?? loaded;
		return Array.isArray(value) ? (value as Route[]) : routesOfModule(value as Type<unknown>, registry);
	}
	return null;
}

interface MatchContext {
	registry: PageRouteRegistryService;
	/** The children of `/pages`, where an absolute `/pages/…` redirect starts over. */
	root: Route[];
	redirects: number;
}

/**
 * The route chain the router would activate for `segments` (relative to `routes`), or null when the URL
 * ends on the `**` "not found" page or matches nothing. Redirects are followed, as the router does.
 */
async function match(routes: Route[], segments: string[], context: MatchContext): Promise<Route[] | null> {
	for (const route of routes) {
		if (route.path === undefined) {
			continue;
		}
		if (route.path === '**') {
			// The catch-all is the "not found" page, never a record's page.
			return null;
		}
		const parts = route.path === '' ? [] : route.path.split('/');
		if (parts.length > segments.length) {
			continue;
		}
		if (!parts.every((part, index) => part.startsWith(':') || part === segments[index])) {
			continue;
		}
		const rest = segments.slice(parts.length);
		if (route.redirectTo !== undefined) {
			if ((route.pathMatch === 'full' && rest.length > 0) || typeof route.redirectTo !== 'string') {
				continue;
			}
			if (++context.redirects > 10) {
				throw new Error(`Redirect loop at ${route.redirectTo}`);
			}
			const [target] = route.redirectTo.split('?');
			const redirected = target.split('/').filter(Boolean);
			return target.startsWith('/')
				? match(context.root, [...redirected.slice(1), ...rest], context) // drop the `pages` prefix
				: match(routes, [...redirected, ...rest], context);
		}
		const children = await childrenOf(route, context.registry);
		if (children) {
			// A parent whose (empty) children list ends the URL is a destination: e.g. the dashboard's
			// `''` child, whose guard picks the tab to show.
			if (children.length === 0 && rest.length === 0) {
				return [route];
			}
			const chain = await match(children, rest, context);
			if (chain) {
				return [route, ...chain];
			}
			continue;
		}
		if (rest.length === 0 && (route.component || route.loadComponent)) {
			return [route];
		}
	}
	return null;
}

function linksToCheck(): Array<[BaseEntityEnum, string]> {
	const links: Array<[BaseEntityEnum, string]> = [];
	for (const entity of Object.values(BaseEntityEnum)) {
		const records = RECORDS[entity] ?? [undefined];
		for (const record of records) {
			links.push([entity, ENTITY_LINKS[entity](ID, record as any)]);
		}
	}
	return links;
}

describe('favorite links resolve to real pages', () => {
	const registry = createRegistry();
	const routes = getPagesRoutes(registry);

	it.each(linksToCheck())(
		'%s → %s',
		async (_entity, link) => {
			expect(link.startsWith('/pages/')).toBe(true);
			const [path] = link.split('?');
			const segments = path.split('/').filter(Boolean).slice(1); // drop the `pages` prefix (the app route)
			const root = routes[0].children ?? [];
			const chain = await match(root, segments, { registry, root, redirects: 0 });
			expect(chain).not.toBeNull();
			expect(chain[chain.length - 1].component).not.toBe(NotFoundComponent);
		},
		120_000
	);
});
