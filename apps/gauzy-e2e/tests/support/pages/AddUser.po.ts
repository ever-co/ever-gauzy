import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	clearField,
	verifyText,
	waitElementToHide,
	waitUntil,
	dispatchClickWhenSettled,
	applySmartTableFilter,
	clickWhenEnabled,
	verifyElementNotExist,
	uploadImageThroughUploader
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { AddUserPage } from '../../../src/support/Base/pageobjects/AddUserPageObject';

export const addUserButtonVisible = async () => {
	await verifyElementIsVisible(AddUserPage.addUserButtonCss);
};

export const clickAddUserButton = async () => {
	// Same overlay as the Invite button: the Users card's [nbSpinner] covers the header toolbar while
	// the grid loads, so the old coordinate force-click was eaten and #firstName never appeared.
	// Settle, dispatch at the button, confirm the mutation dialog opened.
	await dispatchClickWhenSettled(AddUserPage.addUserButtonCss, AddUserPage.firstNameInputCss);
};

// Narrow the users grid to one full name so the user just created is the only data row on page 1.
// Without it verifyUserExists asserts against page 1 of a grid the new user is not on.
export const filterByName = async (name: string) => {
	await applySmartTableFilter(AddUserPage.nameFilterInputCss, name);
};

export const firstNameInputVisible = async () => {
	await verifyElementIsVisible(AddUserPage.firstNameInputCss);
};

export const enterFirstNameData = async (data) => {
	await clearField(AddUserPage.firstNameInputCss);
	await enterInput(AddUserPage.firstNameInputCss, data);
};

export const lastNameInputVisible = async () => {
	await verifyElementIsVisible(AddUserPage.lastNameInputCss);
};

export const enterLastNameData = async (data) => {
	await clearField(AddUserPage.lastNameInputCss);
	await enterInput(AddUserPage.lastNameInputCss, data);
};

export const usernameInputVisible = async () => {
	await verifyElementIsVisible(AddUserPage.usernameInputCss);
};

export const enterUsernameData = async (data) => {
	await clearField(AddUserPage.usernameInputCss);
	await enterInput(AddUserPage.usernameInputCss, data);
};

export const emailInputVisible = async () => {
	await verifyElementIsVisible(AddUserPage.emailInputCss);
};

export const enterEmailData = async (data) => {
	await clearField(AddUserPage.emailInputCss);
	await enterInput(AddUserPage.emailInputCss, data);
};

export const selectUserRoleVisible = async () => {
	await verifyElementIsVisible(AddUserPage.selectRoleDropdownCss);
};

export const selectUserRoleData = async (data) => {
	await clickButton(AddUserPage.selectRoleDropdownCss);
	await clickElementByText(AddUserPage.selectRoleDropdownOptionCss, data);
};

export const passwordInputVisible = async () => {
	await verifyElementIsVisible(AddUserPage.passwordInputCss);
};

export const enterPasswordInputData = async (data) => {
	await clearField(AddUserPage.passwordInputCss);
	await enterInput(AddUserPage.passwordInputCss, data);
};

// The picture used to be an image-URL text input that the spec typed a URL into. #10336 replaced it with
// the avatar uploader (see AddUserPageObject.imageUploaderInputCss), so "the user is given a picture" is
// now exercised by picking a file in that uploader. The file input is transparent (opacity 0) but laid
// over the 72x72 avatar, so it has a box and counts as visible.
export const imageUploaderVisible = async () => {
	await verifyElementIsVisible(AddUserPage.imageUploaderInputCss);
};

// Picks a PNG in the dialog's avatar uploader and waits for the upload request it triggers (see
// util.uploadImageThroughUploader for why the upload's success is reported, not asserted: the picture is
// optional and the shard's tenant file storage may have been switched to an unreachable S3 bucket).
export const uploadImage = async () => {
	await uploadImageThroughUploader(AddUserPage.userMutationDialogCss);
};

export const confirmAddButtonVisible = async () => {
	await verifyElementIsVisible(AddUserPage.confirmAddUserButtonCss);
};

export const clickConfirmAddButton = async () => {
	// [disabled]="userBasicInfo.form.invalid": a forced click on a still-disabled button is dropped
	// silently, so gate on enabled first (force kept for the dialog's own overlay).
	await clickWhenEnabled(AddUserPage.confirmAddUserButtonCss, { force: true });
	// user-mutation.add() closes the dialog only once the user was registered (on failure it shows a
	// danger toast and stays open), so the dialog detaching is the proof the submit took. Failing here
	// names the real problem instead of a later "user not in grid".
	await verifyElementNotExist(AddUserPage.userMutationDialogCss);
};

export const verifyUserExists = async (text) => {
	await waitUntil(3000);
	await verifyText(`${AddUserPage.verifyUserCss}:has-text("${text}")`, text);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(AddUserPage.toastrMessageCss);
};

export const goToEndOfUserList = async () => {
	await clickButton(AddUserPage.endOfUserListCss);
};
