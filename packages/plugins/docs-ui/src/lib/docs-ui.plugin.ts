import { FeatureEnum, PermissionsEnum } from '@gauzy/contracts';
import { PluginNavItemInput, PluginRouteInput, PluginUiDefinition } from '@gauzy/plugin-ui';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { DOCS_PAGE_LINK, DOCS_SECTIONS_LOCATION, DOCS_SETTINGS_LINK, DOCS_SETTINGS_PATH } from './docs.constants';
import { DocsUiModule } from './docs-ui.module';
import en from '../i18n/en.json';

export { DOCS_PAGE_LINK, DOCS_SECTIONS_LOCATION, DOCS_SETTINGS_LINK, DOCS_SETTINGS_PATH };

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
	routes: [DOCS_PAGE_ROUTE, DOCS_SETTINGS_ROUTE],

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
				items: []
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
