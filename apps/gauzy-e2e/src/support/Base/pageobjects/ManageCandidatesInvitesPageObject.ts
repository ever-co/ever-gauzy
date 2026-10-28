export const ManageCandidatesInvitesPage = {
	inviteButtonCss: 'button.invite-button',
	// Shared invite dialog (ga-invite-mutation > ga-email-invite-form), scoped to the dialog host.
	inviteDialogCss: 'ga-invite-mutation',
	emailInputCss: 'ga-invite-mutation #emails',
	dateInputCss: 'ga-invite-mutation #appliedDate',
	// The invite dialog was redesigned: its footer is `nb-card-footer.invite-footer` with a ghost Cancel and
	// a PRIMARY send button ("Invite Candidates") in `.actions`, [disabled] while the email form is invalid.
	// The old direct `nb-card-footer > button[status="success"]` no longer exists.
	// (packages/ui-core/shared/src/lib/invite/invite-mutation/invite-mutation.component.html)
	saveButtonCss: 'ga-invite-mutation nb-card-footer.invite-footer .actions button[status="primary"]',
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	// Email-column filter of the invites grid (InputFilterComponent -> server-side ILIKE on email).
	emailFilterInputCss: 'th.angular2-smart-th.email input',
	resendInviteButtonCss: 'button.action.warning',
	deleteInviteButtonCss: 'button.action:has(nb-icon[icon="trash-2-outline"])',
	// Deleting an invite now opens ga-invite-delete-confirmation (699b3c7187 / #10761): the danger Delete
	// button stays [disabled] until the invitee's email is typed back into #invite-delete-email.
	deleteDialogCss: 'ga-invite-delete-confirmation',
	deleteConfirmationInputCss: 'ga-invite-delete-confirmation input#invite-delete-email',
	confirmDeleteButtonCss: 'ga-invite-delete-confirmation nb-card-footer > button[status="danger"]',
	confirmResendInviteButtonCss: 'ga-resend-confirmation nb-card-footer > button[status="success"]',
	toastrMessageCss: 'nb-toast.ng-trigger',
	verifyEmailCss: 'angular2-smart-table',
	headerPageCss: 'ngx-header-title',
	emailPlaceholderCss: 'input-filter > input[placeholder="Email"]'
};
