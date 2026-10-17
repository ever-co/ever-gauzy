import { Injector } from '@angular/core';
import { IEmployeeProposalTemplate } from '@gauzy/contracts';
import { ProposalTemplateService } from '@gauzy/ui-core/core';
import { IRecordViewRouteData, IRecordViewScope, IRecordViewSection } from '@gauzy/ui-core/shared';

/**
 * A proposal template, described for `ngx-record-view`. Shared by the templates drawer and the template's
 * full-width page.
 */
export function buildProposalTemplateViewSections(): IRecordViewSection[] {
	return [
		{
			fields: [
				{ label: 'PROPOSAL_TEMPLATE.EMPLOYEE', key: 'employee', type: 'person' },
				{ label: 'PROPOSAL_TEMPLATE.NAME', key: 'name' },
				{ label: 'PROPOSAL_TEMPLATE.IS_DEFAULT', key: 'isDefault', type: 'boolean' }
			]
		},
		{
			fields: [{ label: 'PROPOSAL_TEMPLATE.DESCRIPTION', key: 'content', type: 'html', wide: true }]
		}
	];
}

/** `/pages/jobs/proposal-template/view/:id` — one proposal template, full width. */
export const PROPOSAL_TEMPLATE_RECORD_VIEW: IRecordViewRouteData<IEmployeeProposalTemplate> = {
	heading: 'PROPOSAL_TEMPLATE.PROPOSAL_TEMPLATE',
	backLink: '/pages/jobs/proposal-template',
	load: async (id: string, injector: Injector, scope: IRecordViewScope) => {
		const { items } = await injector.get(ProposalTemplateService).getAll({
			where: { id, organizationId: scope.organizationId, tenantId: scope.tenantId },
			relations: ['employee', 'employee.user']
		});
		return items?.find((item) => item.id === id) ?? null;
	},
	sections: () => buildProposalTemplateViewSections(),
	subtitle: (template) => template.name
};
