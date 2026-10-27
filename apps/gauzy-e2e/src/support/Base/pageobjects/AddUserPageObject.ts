export const AddUserPage = {
	addUserButtonCss: 'button.action.status-success',
	// Full Name column filter input in the users smart-table header (tr.angular2-smart-filters). The
	// grid pages at 10 and the shared serial DB accumulates users, so a just-added user lands on page 2
	// and never renders — verifyUserExists then fails on a user that was created perfectly well.
	nameFilterInputCss: 'th.angular2-smart-th.fullName input',
	firstNameInputCss: '#firstName',
	lastNameInputCss: '#lastName',
	usernameInputCss: '#username',
	emailInputCss: '#email',
	selectRoleDropdownCss: 'nb-select#role>button',
	selectRoleDropdownOptionCss: '.option-list nb-option',
	passwordInputCss: 'input#password',
	// The Add User dialog host (user-mutation.component, opened by users.component add() as an nb-dialog
	// in the cdk overlay). Scope for everything that must hit THIS dialog.
	userMutationDialogCss: 'ga-user-mutation',
	// The image-URL text input ([placeholder="Image"]) is gone: #10336 (a73de1d121) replaced it in the
	// shared ga-user-basic-info-form with an avatar uploader — a transparent `<input type="file">`
	// (ngx-image-uploader) laid over the avatar that uploads the picked file to
	// /api/image-assets/upload/profile_pictures (basic-info-form.component.html, Profile section).
	imageUploaderInputCss: 'ga-user-mutation ngx-image-uploader input[type="file"]',
	// "Add User" submit in the dialog footer (`class="green" outline`, [disabled]="userBasicInfo.form.invalid").
	confirmAddUserButtonCss: 'ga-user-mutation nb-card-footer > button.green',
	verifyUserCss: 'div.names-wrapper',
	toastrMessageCss: 'nb-toast.ng-trigger',
	endOfUserListCss: 'ul > li:nth-of-type(9)'
};
