export const ApprovalRequestPage = {
	gridButtonCss: 'div.layout-switch > button',
	addApprovalRequestButtonCss: 'button[status="success"]',
	editApprovalRequestButtonCss: 'button.action.primary',
	deleteApprovalRequestButtonCss: 'button:has(nb-icon[icon="trash-2-outline"])',
	// DeleteConfirmationComponent footer "OK" button (status="danger") — the delete only fires after this
	// confirmation; clicking the toolbar trash button alone just opens the dialog.
	confirmDeleteButtonCss: 'nb-card-footer > button[status="danger"]',
	nameInputCss: '[formcontrolname="name"]',
	minCountInputCss: '[formcontrolname="min_count"]',
	approvalPolicyDropdownCss: '[formcontrolname="approvalPolicyId"]',
	checkApprovalPolicyDropdownOptionCss: '.option-list nb-option',
	usersMultiSelectCss: 'ga-employee-multi-select nb-select button.select-button',
	checkUsersMultiSelectCss: '.option-list nb-option',
	saveButtonCss: 'nb-card-footer > button[status="success"]',
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	approvalPolicyButtonCss: 'button[status="primary"]:has-text("Approval Policy")',
	descriptionInputCss: '[formcontrolname="description"]',
	backButtonCss: 'ngx-back-navigation button',
	toastrMessageCss: 'nb-toast.ng-trigger',
	verifyApprovalPolicyCss: 'angular2-smart-table table tbody',
	verifyRequestCss: 'angular2-smart-table table tbody',
	addTagsDropdownCss: '#addTags',
	tagsDropdownOption: 'div.ng-option',
	headerCss: 'nb-dialog-container > nb-card.main',
	approvalRefuseButtonCss: 'table > tbody > tr.angular2-smart-row > td.ng-star-inserted',
	approvalStatusCss: 'table > tbody > tr.angular2-smart-row',
	searchByNameInputCss: 'input[placeholder="Name"]',
	rowCss: 'table > tbody > tr.angular2-smart-row',
	tableBodyCss: 'table > tbody',
	// Name-column filter input in the smart-table header (tr.angular2-smart-filters). The approvals grid
	// is shared/serial and accumulates rows from earlier specs + earlier runs, so typing the request's
	// unique faker name filters the grid down to just OUR record — making row selection / verify-exists /
	// verify-deleted order-independent (mirrors ManageEmployees' th.angular2-smart-th.fullName filter).
	nameFilterInputCss: 'th.angular2-smart-th.name input',
	// Approval-POLICY page Name-column filter (server-side ga-input-filter-selector, placeholder = column
	// title "Name"). The policy grid is paginated server-side, so filtering by the unique policy name
	// guarantees our just-created policy renders even if earlier specs/runs left many policies.
	policyNameFilterInputCss: 'ga-input-filter-selector input[placeholder="Name"]',
	// Approval-policy page "Add" button (button[status="success"], (click)="add()"). On the approval-policy
	// page the toolbar renders just this one success button, so it's unambiguous after a direct hash nav.
	addPolicyButtonCss: 'button[status="success"]'
};
