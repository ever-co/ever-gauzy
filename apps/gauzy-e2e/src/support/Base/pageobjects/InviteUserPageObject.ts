export const InviteUserPage = {
	inviteButtonCss: 'button.action.info',
	emailInputCss: '#emails',
	dateInputCss: '#startedWorkOn',
	selectRoleDropdownCss: 'nb-select#role',
	selectRoleDropdownOptionCss: '.option-list nb-option',
	// The invite dialog host (InviteMutationComponent, opened by users.component invite()).
	inviteDialogCss: 'ga-invite-mutation',
	// #10761 (699b3c7187) redesigned the invite dialog: the footer is now `nb-card-footer.invite-footer`
	// with a recipient count and an `.actions` group (ghost Cancel + the primary "Invite Users" send button,
	// [disabled]="emailInviteForm.form.invalid"). The old `nb-card-footer.text-left > button[status="success"]`
	// no longer exists (invite-mutation.component.html).
	sendInviteButtonCss: 'ga-invite-mutation nb-card-footer.invite-footer .actions button[status="primary"]'
};
