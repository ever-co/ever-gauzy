import { Injector } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { IRequestApproval, RequestApprovalStatusTypesEnum } from '@gauzy/contracts';
import { RequestApprovalService } from '@gauzy/ui-core/core';
import { IRecordViewRouteData, IRecordViewScope, IRecordViewSection } from '@gauzy/ui-core/shared';

/** Relations an approval request's View reads — those of the approvals grid, plus its policy. */
export const APPROVAL_VIEW_RELATIONS = [
	'employeeApprovals',
	'employeeApprovals.employee',
	'employeeApprovals.employee.user',
	'teamApprovals',
	'teamApprovals.team',
	'tags',
	'createdByUser',
	'approvalPolicy'
];

/** The approvals grid's status badge: approved green, requested amber, refused red. */
export function approvalStatusBadge(
	status: RequestApprovalStatusTypesEnum | number,
	translate: (key: string) => string
): { text: string; value: unknown; class: string } {
	switch (status) {
		case RequestApprovalStatusTypesEnum.APPROVED:
			return { text: translate('APPROVAL_REQUEST_PAGE.APPROVED'), value: status, class: 'success' };
		case RequestApprovalStatusTypesEnum.REFUSED:
			return { text: translate('APPROVAL_REQUEST_PAGE.REFUSED'), value: status, class: 'danger' };
		default:
			return { text: translate('APPROVAL_REQUEST_PAGE.REQUESTED'), value: status, class: 'warning' };
	}
}

/**
 * An approval request, described for `ngx-record-view` — the grid columns read vertically. Shared by the
 * approvals drawer and the request's full-width page (`/pages/employees/approvals/view/:id`).
 */
export function buildApprovalViewSections(status?: {
	text: string;
	value: unknown;
	class: string;
}): IRecordViewSection[] {
	return [
		{
			fields: [
				{ label: 'APPROVAL_REQUEST_PAGE.APPROVAL_REQUEST_NAME', key: 'name' },
				// The drawer's rows already carry the grid's `{ text, value, class }` badge as `status`; the page
				// passes the badge it builds from the raw status, in the current language.
				{
					label: 'APPROVAL_REQUEST_PAGE.APPROVAL_REQUEST_STATUS',
					type: 'badge',
					...(status ? { value: status } : { key: 'status' })
				},
				{ label: 'APPROVAL_REQUEST_PAGE.APPROVAL_REQUEST_MIN_COUNT', key: 'min_count' },
				{ label: 'APPROVAL_REQUEST_PAGE.APPROVAL_REQUEST_APPROVAL_POLICY', key: 'approvalPolicy.name' }
			]
		},
		{
			title: 'APPROVAL_REQUEST_PAGE.EMPLOYEES',
			fields: [
				{ label: 'APPROVAL_REQUEST_PAGE.EMPLOYEES', key: 'employees', type: 'people', wide: true },
				{ label: 'APPROVAL_REQUEST_PAGE.TEAMS', key: 'teams', type: 'teams', wide: true }
			]
		},
		{
			fields: [
				{ label: 'SM_TABLE.TAGS', key: 'tags', type: 'tags', wide: true },
				{ label: 'APPROVAL_REQUEST_PAGE.CREATED_BY', key: 'createdByUser', type: 'person' },
				{ label: 'APPROVAL_REQUEST_PAGE.CREATED_AT', key: 'createdAt', type: 'datetime' }
			]
		}
	];
}

/** `/pages/employees/approvals/view/:id` — one approval request, full width. */
export const APPROVAL_RECORD_VIEW: IRecordViewRouteData<IRequestApproval> = {
	heading: 'APPROVAL_REQUEST_PAGE.HEADER',
	backLink: '/pages/employees/approvals',
	load: async (id: string, injector: Injector, scope: IRecordViewScope) => {
		const { items } = await injector.get(RequestApprovalService).getAll(APPROVAL_VIEW_RELATIONS, {
			id,
			organizationId: scope.organizationId,
			tenantId: scope.tenantId
		} as any);
		const request: any = items?.find((item) => item.id === id);
		if (!request) {
			return null;
		}
		return {
			...request,
			employees: (request.employeeApprovals ?? []).map((approval) => approval.employee),
			teams: (request.teamApprovals ?? []).map((approval) => approval.team)
		};
	},
	// The badge is built with the sections, so a language change re-translates it (the raw status stays).
	sections: (request, injector) => {
		const translateService = injector.get(TranslateService);
		return buildApprovalViewSections(approvalStatusBadge(request.status, (key) => translateService.instant(key)));
	},
	subtitle: (request) => request.name
};
