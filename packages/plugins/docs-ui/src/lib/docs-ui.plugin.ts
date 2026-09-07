import { FeatureEnum, PermissionsEnum } from '@gauzy/contracts';
import { PluginNavItemInput, PluginRouteInput, PluginUiDefinition } from '@gauzy/plugin-ui';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import {
	DOCS_INBOUND_SETTINGS_LINK,
	DOCS_INBOUND_SETTINGS_PATH,
	DOCS_PAGE_LINK,
	DOCS_SECTIONS_LOCATION,
	DOCS_SETTINGS_LINK,
	DOCS_SETTINGS_PATH
} from './docs.constants';
import { DocsUiModule } from './docs-ui.module';
import en from '../i18n/en.json';

export {
	DOCS_INBOUND_SETTINGS_LINK,
	DOCS_INBOUND_SETTINGS_PATH,
	DOCS_PAGE_LINK,
	DOCS_SECTIONS_LOCATION,
	DOCS_SETTINGS_LINK,
	DOCS_SETTINGS_PATH
};

/** Route registration for the Documents hub at /pages/documents. */
export const DOCS_PAGE_ROUTE: PluginRouteInput = {
	location: 'page-sections',
	path: 'documents',
	loadChildren: () => import('./docs-ui.module').then((m) => m.DocsUiModule)
};

/**
 * Documents settings page at /pages/settings/documents (`04-frontend-plugin.md` §2.1).
 *
 * Registered at `settings-sections` — i.e. as a CHILD of the core settings shell —
 * so it renders with the settings menu beside it. `loadComponent` keeps the
 * standalone page out of the eagerly instantiated `DocsUiModule` and out of the
 * browse chunk.
 */
export const DOCS_SETTINGS_ROUTE: PluginRouteInput = {
	location: 'settings-sections',
	path: DOCS_SETTINGS_PATH,
	loadComponent: () =>
		import('./pages/settings/docs-settings-page.component').then((m) => m.DocsSettingsPageComponent),
	canActivate: [PermissionsGuard],
	data: {
		permissions: {
			only: [PermissionsEnum.DOCS_MANAGE],
			redirectTo: '/pages/settings'
		},
		selectors: {
			project: false,
			team: false,
			employee: false,
			date: false
		}
	}
};

/**
 * Inbound email capture settings at /pages/settings/documents-inbound (spec 07 §17.2).
 *
 * Same shape as {@link DOCS_SETTINGS_ROUTE} — a sibling `settings-sections` child, standalone
 * and `loadComponent`-ed so the capture surface (and the two dialogs it opens) stay out of both
 * the browse chunk and the defaults-settings chunk.
 *
 * `DOCS_MANAGE` rather than `DOCS_READ`: adding a capture address opens an ingestion channel
 * into the organization, which is exactly how the backend controller gates its mutations.
 */
export const DOCS_INBOUND_SETTINGS_ROUTE: PluginRouteInput = {
	location: 'settings-sections',
	path: DOCS_INBOUND_SETTINGS_PATH,
	loadComponent: () =>
		import('./pages/settings/docs-inbound-settings-page.component').then(
			(m) => m.DocsInboundSettingsPageComponent
		),
	canActivate: [PermissionsGuard],
	data: {
		permissions: {
			only: [PermissionsEnum.DOCS_MANAGE],
			redirectTo: '/pages/settings'
		},
		selectors: {
			project: false,
			team: false,
			employee: false,
			date: false
		}
	}
};

/**
 * Documents hub UI plugin (`@gauzy/plugin-docs-ui`).
 *
 * Declarative `PluginUiDefinition`: a top-level "Documents" nav section
 * (directly below Dashboards, before the `focus` entry), the
 * `/pages/documents` route, the `DOCS` translation namespace, and
 * feature/permission activation gates.
 *
 * @example In `apps/gauzy/src/plugin-ui.config.ts`:
 * ```ts
 * plugins: [DocsUiPlugin]
 * ```
 */
export const DocsUiPlugin: PluginUiDefinition = {
	id: 'docs',

	// ── Versioning & Compatibility ────────────────────────────────
	version: '0.1.0',

	// ── Location & Module ────────────────────────────────────────
	location: DOCS_SECTIONS_LOCATION,
	module: DocsUiModule,

	// ── Routes ───────────────────────────────────────────────────
	routes: [DOCS_PAGE_ROUTE, DOCS_SETTINGS_ROUTE, DOCS_INBOUND_SETTINGS_ROUTE],

	// ── Navigation ───────────────────────────────────────────────
	navMenu: [
		{
			type: 'config' as const,
			// `pathMatch` rides through to the NavMenuSectionItem (NbMenuItem field);
			// PluginNavItemInput is the decoupled minimal shape, hence the cast.
			config: {
				id: 'documents',
				title: 'Documents',
				icon: 'fas fa-book',
				link: DOCS_PAGE_LINK,
				pathMatch: 'prefix' as const,
				data: {
					translationKey: 'MENU.DOCUMENTS',
					featureKey: FeatureEnum.FEATURE_DOCUMENTS,
					permissionKeys: [PermissionsEnum.DOCS_READ],
					add: `${DOCS_PAGE_LINK}?upload=1`
				},
				// 🛑 No `items` key at all. An empty children array can make Nebular treat the entry as an
				// expandable GROUP, so clicking it toggles expansion instead of routing — which presents
				// exactly as "clicking Documents does nothing" (item highlights, URL never changes).
				// Warm in-app navigation to the same link via the router works, so the route is fine.
			} as PluginNavItemInput,
			before: 'focus'
		},
		{
			// Item under the CORE Settings section (ai-chat-react-ui precedent) —
			// the hub's own review queue and settings are reached in-page, this is
			// the org-level configuration entry.
			type: 'section' as const,
			sectionId: 'settings',
			items: [
				{
					id: 'settings-documents',
					title: 'Documents',
					icon: 'fas fa-book',
					link: DOCS_SETTINGS_LINK,
					data: {
						translationKey: 'MENU.DOCUMENTS',
						featureKey: FeatureEnum.FEATURE_DOCUMENTS,
						permissionKeys: [PermissionsEnum.DOCS_MANAGE]
					}
				} as PluginNavItemInput,
				{
					// Inbound email capture (spec 07 §17.2). `translationKey` points at the
					// plugin's OWN namespace rather than `MENU.*`: the nav renderer translates
					// whatever key it is given (`base-nav-menu.component.ts` already mixes
					// `MENU.*` with `DASHBOARD_PAGE.*`), and `en.json` here is the one file
					// that has to stay in step — the 14 app-wide bundles carry no DOCS keys.
					id: 'settings-documents-inbound',
					title: 'Inbound email',
					icon: 'fas fa-envelope',
					link: DOCS_INBOUND_SETTINGS_LINK,
					data: {
						translationKey: 'DOCS.INBOUND.MENU',
						featureKey: FeatureEnum.FEATURE_DOCUMENTS,
						permissionKeys: [PermissionsEnum.DOCS_MANAGE]
					}
				} as PluginNavItemInput
			]
		}
	],

	// ── i18n ─────────────────────────────────────────────────────
	translationNamespace: 'DOCS',
	translations: { en },

	// ── Access Control ───────────────────────────────────────────
	featureKey: FeatureEnum.FEATURE_DOCUMENTS,
	permissionKeys: [PermissionsEnum.DOCS_READ],

	// ── Loading ──────────────────────────────────────────────────
	loadStrategy: 'lazy'
};
