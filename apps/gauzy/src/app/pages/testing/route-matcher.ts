// cspell:ignore ɵinj
import { Provider, Type } from '@angular/core';
import { LoadChildrenCallback, Route, Routes, ROUTES } from '@angular/router';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';

/*
 * Test helper: resolves an app URL against the REAL route configuration, the way the router does — every
 * lazy `loadChildren` on the way is loaded and its `ROUTES` read from the NgModule's injector definition
 * (`useValue` and `useFactory`), then matched with the router's rules for the shapes these route tables
 * use (literal and `:param` segments, `''` prefix routes, children, redirects followed). Landing on the
 * `**` catch-all ("not found") is a miss. Used by the specs that check every link the app builds for a
 * record page (favorites, drawer expand icons).
 */

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

export interface MatchContext {
	registry: PageRouteRegistryService;
	/** The children of `/pages`, where an absolute `/pages/…` redirect starts over. */
	root: Route[];
	redirects: number;
}

/**
 * The route chain the router would activate for `segments` (relative to `routes`), or null when the URL
 * ends on the `**` "not found" page or matches nothing. Redirects are followed, as the router does.
 */
export async function match(routes: Route[], segments: string[], context: MatchContext): Promise<Route[] | null> {
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

/**
 * The route chain `link` (an absolute `/pages/…` URL, query string allowed) activates under `pagesRoutes`
 * (what `getPagesRoutes()` returns), or null when it ends on "not found" or matches nothing.
 */
export async function resolvePagesLink(
	pagesRoutes: Routes,
	link: string,
	registry: PageRouteRegistryService
): Promise<Route[] | null> {
	const [path] = link.split('?');
	const segments = path.split('/').filter(Boolean).slice(1); // drop the `pages` prefix (the app route)
	const root = pagesRoutes[0].children ?? [];
	return match(root, segments, { registry, root, redirects: 0 });
}
