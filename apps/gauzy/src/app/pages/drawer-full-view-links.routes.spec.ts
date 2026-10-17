/*
 * The Documents plugin's PDF viewer reaches pdfjs through `import.meta.url`, which the CommonJS test runtime
 * cannot load; the tasks and employees modules import the plugin's record-side panel.
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

import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { NotFoundComponent, RecordViewRoutePageComponent } from '@gauzy/ui-core/shared';
// Not part of the plugins' public barrels: each plugin registers its routes itself at bootstrap.
import { JOBS_PAGE_ROUTE } from '../../../../../packages/plugins/jobs-ui/src/lib/job.routes';
import { JOB_PROPOSAL_TEMPLATE_PAGE_ROUTE } from '../../../../../packages/plugins/job-proposal-ui/src/lib/proposal-template/job-proposal-template.routes';
import { getPagesRoutes } from './pages.routes';
import { resolvePagesLink } from './testing/route-matcher';

const ID = 'aaaaaaaa-1111-4111-8111-111111111111';

/**
 * Every right-side preview drawer gets a small "expand to full width" icon that opens the record's own
 * full-width page — "bookmarkable and shareable" (owner, 2026-10-13, handover §4.P). Each link a drawer
 * builds must therefore be a real route; the drawer-only records got a `view/:id` page for it.
 */
const DRAWER_LINKS: Array<[string, string, boolean]> = [
	// [drawer, the link it builds, whether the destination is a generic record page]
	['tasks', `/pages/tasks/view/${ID}`, false],
	['expenses', `/pages/accounting/expenses/view/${ID}`, true],
	['income', `/pages/accounting/income/view/${ID}`, true],
	['approval requests', `/pages/employees/approvals/view/${ID}`, true],
	['organization recurring expenses', `/pages/accounting/expense-recurring/view/${ID}`, true],
	['employee recurring expenses', `/pages/employees/recurring-expenses/view/${ID}`, true],
	['goal KPIs', `/pages/goals/settings/kpi/${ID}`, true],
	['goal time frames', `/pages/goals/settings/time-frame/${ID}`, true],
	['inventory merchants', `/pages/organization/inventory/merchants/view/${ID}`, true],
	['proposal templates', `/pages/jobs/proposal-template/view/${ID}`, true],
	['users', `/pages/users/edit/${ID}`, false],
	['organizations', `/pages/organizations/edit/${ID}`, false],
	['job employees', `/pages/employees/view/${ID}`, false]
];

describe('drawer "expand to full width" links resolve to real pages', () => {
	const registry = new PageRouteRegistryService();
	registry.registerPageRoute(JOBS_PAGE_ROUTE);
	registry.registerPageRoute(JOB_PROPOSAL_TEMPLATE_PAGE_ROUTE);
	const routes = getPagesRoutes(registry);

	it.each(DRAWER_LINKS)(
		'%s → %s',
		async (_drawer, link, generic) => {
			const chain = await resolvePagesLink(routes, link, registry);
			expect(chain).not.toBeNull();
			const page = chain[chain.length - 1];
			expect(page.component).not.toBe(NotFoundComponent);
			if (generic) {
				expect(page.component).toBe(RecordViewRoutePageComponent);
				expect(page.data?.['recordView']).toEqual(
					expect.objectContaining({ heading: expect.any(String), load: expect.any(Function) })
				);
			}
		},
		120_000
	);
});
