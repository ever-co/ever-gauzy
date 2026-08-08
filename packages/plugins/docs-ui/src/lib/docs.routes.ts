import { Route } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PageRouteRegistryService, PermissionsGuard } from '@gauzy/ui-core/core';
import { DocsShellComponent } from './components/shell/docs-shell.component';
import { DOCS_PAGE_LINK, DOCS_SECTIONS_LOCATION } from './docs.constants';
import { docsFeatureGuard } from './guards/docs-feature.guard';
import { DocsBrowsePageComponent } from './pages/browse/docs-browse-page.component';
import { ReviewPageComponent } from './pages/review/review-page.component';

/**
 * Builds the internal route table for /pages/documents: shell (tree column +
 * router-outlet + detail panel host) with the browse list, the lazily loaded
 * page editor (the full TipTap editor stack is one chunk behind this route —
 * spec 05 §12), the review queue, and any routes other plugins contributed at
 * the 'documents-sections' location.
 */
export function createDocsRoutes(registry: PageRouteRegistryService): Route[] {
	return [
		{
			path: '',
			component: DocsShellComponent,
			canActivate: [docsFeatureGuard, PermissionsGuard],
			data: {
				permissions: {
					only: [PermissionsEnum.DOCS_READ],
					redirectTo: '/pages/dashboard'
				},
				// Documents is org-scoped — header context selectors are all disabled.
				selectors: {
					project: false,
					team: false,
					employee: false,
					date: false
				}
			},
			children: [
				{
					path: '',
					component: DocsBrowsePageComponent,
					data: { title: 'DOCS.TITLE' }
				},
				{
					path: 'page/:id',
					loadComponent: () =>
						import('./pages/page-editor/document-page.component').then((m) => m.DocumentPageComponent),
					data: { title: 'DOCS.EDITOR.TITLE' }
				},
				{
					path: 'review',
					component: ReviewPageComponent,
					canActivate: [PermissionsGuard],
					data: {
						permissions: {
							only: [PermissionsEnum.DOCS_REVIEW],
							redirectTo: DOCS_PAGE_LINK
						},
						title: 'DOCS.REVIEW.QUEUE_TITLE'
					}
				},
				...registry.getPageLocationRoutes(DOCS_SECTIONS_LOCATION)
			]
		}
	];
}
