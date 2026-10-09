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
	imageInputUrlCss: '[placeholder="Image"]',
	confirmAddUserButtonCss:
		'button.green.appearance-outline',
	verifyUserCss: 'div.names-wrapper',
	toastrMessageCss: 'nb-toast.ng-trigger',
	endOfUserListCss: 'ul > li:nth-of-type(9)'
};
