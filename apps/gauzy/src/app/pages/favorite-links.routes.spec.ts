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

import { BaseEntityEnum, DocumentKindEnum } from '@gauzy/contracts';
import { ENTITY_LINKS, PageRouteRegistryService } from '@gauzy/ui-core/core';
import { NotFoundComponent } from '@gauzy/ui-core/shared';
import { DOCS_PAGE_ROUTE } from '@gauzy/plugin-docs-ui';
// Not part of the plugin's public barrel: the plugin registers it itself at bootstrap.
import { JOB_PROPOSAL_SALES_ROUTE } from '../../../../../packages/plugins/job-proposal-ui/src/lib/proposal/job-proposal.routes';
import { getPagesRoutes } from './pages.routes';
import { resolvePagesLink } from './testing/route-matcher';

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
			const chain = await resolvePagesLink(routes, link, registry);
			expect(chain).not.toBeNull();
			expect(chain[chain.length - 1].component).not.toBe(NotFoundComponent);
		},
		120_000
	);
});
