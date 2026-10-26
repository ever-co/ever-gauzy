export const ManageUserInvitesPage = {
	manageInvitesButtonCss: 'button[status="primary"]:has-text("Manage Invites")',
	gridButtonCss: 'div.layout-switch > button',
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	// Email column filter of the invites grid (ga-invites, invites.component: `email` column with the
	// custom InputFilterComponent, a reactive input that filters server-side). Column-key class, not the
	// translated placeholder.
	emailFilterInputCss: 'th.angular2-smart-th.email input',
	copyLinkButtonCss: 'button.action.success',
	resendInviteButtonCss: 'button.action.warning',
	deleteInviteButtonCss: 'button.action:has(nb-icon[icon="trash-2-outline"])',
	// Resend confirmation (ResendConfirmationComponent): Cancel = outline basic, OK = success.
	cancelResendInviteButtonCss: 'ga-resend-confirmation nb-card-footer button[status="basic"]',
	confirmResendInviteButtonCss: 'ga-resend-confirmation nb-card-footer button[status="success"]',
	// Delete confirmation: #10761 (699b3c7187) replaced the shared OK/Cancel DeleteConfirmationComponent
	// on the invites page with InviteDeleteConfirmationComponent, whose Delete button stays
	// [disabled]="!isConfirmed" until the invitee's email is typed back into #invite-delete-email
	// (invite-delete-confirmation.component.html; the phrase is shown in strong.confirm-name).
	deleteInviteDialogCss: 'ga-invite-delete-confirmation',
	cancelDeleteInviteButtonCss: 'ga-invite-delete-confirmation nb-card-footer button[status="basic"]',
	confirmDeleteInviteButtonCss: 'ga-invite-delete-confirmation nb-card-footer button[status="danger"]',
	deleteConfirmationPhraseCss: 'ga-invite-delete-confirmation strong.confirm-name',
	deleteConfirmationInputCss: 'ga-invite-delete-confirmation #invite-delete-email',
	toastrMessageCss: 'nb-toast.ng-trigger',
	// Header "Invite" button of the invites page (invites.component #visibleButton) — opens the same
	// InviteMutationComponent dialog as the Users page's Invite button, with invitationType USER.
	inviteButtonCss: 'button.invite-button[status="success"]',
	inviteDialogCss: 'ga-invite-mutation',
	emailInputCss: 'ga-invite-mutation #emails',
	dateInputCss: 'input[formcontrolname="startedWorkOn"]',
	// The redesigned invite dialog's send button (#10761): `nb-card-footer.invite-footer .actions
	// button[status="primary"]` — it used to be `nb-card-footer button[status="success"]`.
	saveButtonCss: 'ga-invite-mutation nb-card-footer.invite-footer .actions button[status="primary"]',
	verifyEmailCss: 'table-cell-view-mode > div > div.ng-star-inserted',
	rolesInputCss: 'ga-invite-mutation nb-select#role',
	rolesDropdownCss: '.option-list nb-option',
	searchEmailInputCss: 'angular2-smart-table-filter input[placeholder="Email"]',
	clientsTableData: 'td.ng-star-inserted',
	clientsTableRow: 'tr.angular2-smart-row'
};
