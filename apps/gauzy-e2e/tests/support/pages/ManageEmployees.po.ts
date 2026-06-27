import dayjs from 'dayjs';
import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	enterInputConditionally,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	waitElementToHide,
	verifyText,
	verifyTextNotExisting,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { ManageEmployeesPage } from '../../../src/support/Base/pageobjects/ManageEmployeesPageObject';

// INVITE EMPLOYEE BY EMAIL
export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const inviteButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.inviteButtonCss);
};

export const clickInviteButton = async () => {
	// Toolbar Invite -> invite() opens the dialog. Settle then dispatch so a mid-transition
	// coordinate click can't land on a fading overlay and miss the handler.
	await waitForSpinnerGone();
	await dispatchClick(ManageEmployeesPage.inviteButtonCss);
};

export const emailInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.emailsInputCss);
};

export const enterEmailData = async (data) => {
	await enterInputConditionally(ManageEmployeesPage.emailsInputCss, data);
};

export const dateInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.dateInputCss);
};

export const enterDateData = async () => {
	await clearField(ManageEmployeesPage.dateInputCss);
	const date = dayjs().format('MMM D, YYYY');
	await enterInput(ManageEmployeesPage.dateInputCss, date);
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const selectProjectDropdownVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.selectProjectDropdownCss);
};

export const clickProjectDropdown = async () => {
	// #projectSelection is an ng-select that opens on mousedown and is blocked by the dialog
	// backdrop; a force coordinate click can also close the form. Open it via keyboard instead.
	const input = getPage()
		.locator(ManageEmployeesPage.selectProjectDropdownCss)
		.locator('input')
		.first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const selectProjectFromDropdown = async (text) => {
	await clickElementByText(
		ManageEmployeesPage.selectProjectDropdownOptionCss,
		text
	);
};

export const sendInviteButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.sendInviteButtonCss);
};

export const clickSendInviteButton = async () => {
	// The invite dialog footer Submit sits under a fading ng-select/dialog backdrop after the
	// project dropdown closes; a coordinate force-click lands on the backdrop and the dialog never
	// closes (next step's #firstName form then never opens). Dispatch the click to the element so
	// the (click)="add()" handler fires regardless of the overlay.
	await waitForSpinnerGone();
	await dispatchClick(ManageEmployeesPage.sendInviteButtonCss);
};

// ADD NEW EMPLOYEE
export const addEmployeeButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.addEmployeeButtonCss);
};

export const clickAddEmployeeButton = async () => {
	// Clicked right after the invite dialog closes; its fading cdk-overlay backdrop intercepts a
	// coordinate click. Dispatch the click so add() fires and the mutation stepper opens.
	await waitForSpinnerGone();
	await dispatchClick(ManageEmployeesPage.addEmployeeButtonCss);
};

export const firstNameInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.firstNameInputCss);
};

export const enterFirstNameData = async (data) => {
	await enterInput(ManageEmployeesPage.firstNameInputCss, data);
};

export const lastNameInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.lastNameInputCss);
};

export const enterLastNameData = async (data) => {
	await enterInput(ManageEmployeesPage.lastNameInputCss, data);
};

export const usernameInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.usernameInputCss);
};

export const enterUsernameData = async (data) => {
	await enterInput(ManageEmployeesPage.usernameInputCss, data);
};

export const employeeEmailInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.emailInputCss);
};

export const enterEmployeeEmailData = async (data) => {
	await enterInput(ManageEmployeesPage.emailInputCss, data);
};

export const passwordInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.passwordInputCss);
};

export const enterPasswordInputData = async (data) => {
	await enterInput(ManageEmployeesPage.passwordInputCss, data);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.addTagsDropdownCss);
};

export const clickTagsDropdown = async () => {
	// ga-tags-color-input is an ng-select that opens on MOUSEDOWN and is backdrop-blocked; a
	// force-click on its control can also close the add form. Open it via keyboard instead.
	const input = getPage()
		.locator(ManageEmployeesPage.addTagsDropdownCss)
		.locator('input')
		.first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const selectTagFromDropdown = async (index) => {
	await clickButtonByIndex(ManageEmployeesPage.tagsDropdownOption, index);
};

export const clickCardBody = async () => {
	await clickButton(ManageEmployeesPage.cardBodyCss);
};

export const imageInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.imgInputCss);
};

export const enterImageDataUrl = async (url) => {
	await enterInput(ManageEmployeesPage.imgInputCss, url);
};

export const nextButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.nextButtonCss);
};

export const clickNextButton = async () => {
	// Stepper step-1 -> step-2 (nbStepperNext). The tags ng-select we just opened (appendTo body)
	// leaves a fading overlay over the footer; dispatch straight on the button.
	await waitForSpinnerGone();
	await dispatchClick(ManageEmployeesPage.nextButtonCss);
};

export const nextStepButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.nextStepButtonCss);
};

export const clickNextStepButton = async () => {
	// Stepper step-2 -> step-3 (nbStepperNext); same backdrop hazard as step-1's Next.
	await waitForSpinnerGone();
	await dispatchClick(ManageEmployeesPage.nextStepButtonCss);
};

export const lastStepButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.lastStepButtonCss);
};

export const clickLastStepButton = async () => {
	// Stepper step-3 "Finished adding" -> (click)="add()" persists the employee and closes the
	// dialog; dispatch through any lingering stepper/overlay backdrop.
	await waitForSpinnerGone();
	await dispatchClick(ManageEmployeesPage.lastStepButtonCss);
};

// EDIT EMPLOYEE

export const tableRowVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.selectTableRowCss);
};

export const selectTableRow = async (index) => {
	// Selecting a grid row TOGGLES selection and enables the toolbar (Edit/End Work/Delete, or the
	// Copy/Resend/Delete buttons on the invites grid). Settle the grid first so the click lands on
	// the rendered row, then click ONCE — a rapid re-click would toggle the selection back off.
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => {});
	await getPage().waitForTimeout(1500);
	await clickButtonByIndex(ManageEmployeesPage.selectTableRowCss, index);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.editEmployeeButtonCss);
};

export const clickEditButton = async () => {
	// Toolbar Edit fires after row selection; dispatch so a fading selection/overlay can't swallow it.
	await dispatchClick(ManageEmployeesPage.editEmployeeButtonCss);
};

export const usernameEditInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.usernameEditSecondInputCss);
};

export const enterUsernameEditInputData = async (data) => {
	await clearField(ManageEmployeesPage.usernameEditSecondInputCss);
	await enterInput(ManageEmployeesPage.usernameEditSecondInputCss, data);
};

export const emailEditInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.emailEditSecondInputCss);
};

export const enterEmailEditInputData = async (data) => {
	await clearField(ManageEmployeesPage.emailEditSecondInputCss);
	await enterInput(ManageEmployeesPage.emailEditSecondInputCss, data);
};

export const firstNameEditInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.firstNameSecondEditInputCss);
};

export const enterFirstNameEditInputData = async (data) => {
	await clearField(ManageEmployeesPage.firstNameSecondEditInputCss);
	await enterInput(ManageEmployeesPage.firstNameSecondEditInputCss, data);
};

export const lastNameEditInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.lastNameSecondEditInputCss);
};

export const enterLastNameEditInputData = async (data) => {
	await clearField(ManageEmployeesPage.lastNameSecondEditInputCss);
	await enterInput(ManageEmployeesPage.lastNameSecondEditInputCss, data);
};

export const preferredLanguageDropdownVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.preferredLanguageDropdownCss);
};

export const clickPreferredLanguageDropdown = async () => {
	// ngx-language-selector is an ng-select that opens on MOUSEDOWN and is backdrop-blocked; a
	// force-click on its control can also close the form. Open it via keyboard instead.
	const input = getPage()
		.locator(ManageEmployeesPage.preferredLanguageDropdownCss)
		.locator('input')
		.first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const selectLanguageFromDropdown = async (text) => {
	await clickElementByText(ManageEmployeesPage.preferredLanguageOptionCss, text);
};

export const saveEditButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.saveEditButtonCss);
};

export const clickSaveEditButton = async () => {
	// Edit-page Save (disabled while form invalid). Settle, then dispatch so (click)="submitForm()"
	// fires even with a transient overlay/spinner from the language ng-select we just closed.
	await waitForSpinnerGone();
	await dispatchClick(ManageEmployeesPage.saveEditButtonCss);
};

export const backButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.backButtonCss);
};

export const clickBackButton = async () => {
	// Clicked right after the edit Save toast; dispatch through any lingering overlay.
	await dispatchClick(ManageEmployeesPage.backButtonCss);
};

// END WORK

export const endWorkButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.endWorkButtonCss);
};

export const clickEndWorkButton = async () => {
	// Toolbar End Work (after row selection) opens the confirm dialog; dispatch through any fading
	// selection overlay so (click)="endWork(...)" fires.
	await dispatchClick(ManageEmployeesPage.endWorkButtonCss);
};

export const confirmEndWorkButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.confirmEndWorkButtonCss);
};

export const clickConfirmEndWorkButton = async () => {
	// Confirm on the freshly-opened End Work dialog; dispatch so its own backdrop can't intercept.
	await dispatchClick(ManageEmployeesPage.confirmEndWorkButtonCss);
};

// DELETE EMPLOYEE

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.deleteEmployeeButtonCss);
};

export const clickDeleteButton = async () => {
	// Toolbar Delete (after row selection) opens the confirm dialog; dispatch through any fading
	// selection overlay.
	await dispatchClick(ManageEmployeesPage.deleteEmployeeButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	// Confirm on the freshly-opened Delete dialog; dispatch so its own backdrop can't intercept.
	await dispatchClick(ManageEmployeesPage.confirmDeleteButtonCss);
};

// COPY INVITE LINK

export const manageInvitesButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.manageInvitesButtonCss);
};

export const clickManageInviteButton = async () => {
	// Header "Manage Invites" routerLink button; clicked after the delete toast, dispatch through
	// any lingering overlay.
	await waitForSpinnerGone();
	await dispatchClick(ManageEmployeesPage.manageInvitesButtonCss);
};

export const copyLinkButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.copyLinkButtonCss);
};

export const clickCopyLinkButton = async () => {
	// Toolbar Copy Link (after row selection); dispatch through any fading selection overlay.
	await dispatchClick(ManageEmployeesPage.copyLinkButtonCss);
};

// RESEND INVITE

export const resendInviteButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.resendInviteButtonCss);
};

export const clickResendInviteButton = async () => {
	// Toolbar Resend (after row selection) opens the confirm dialog; dispatch through any fading
	// selection overlay.
	await dispatchClick(ManageEmployeesPage.resendInviteButtonCss);
};

export const confirmResendInviteButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.confirmResendInviteButtonCss);
};

export const clickConfirmResendInviteButton = async () => {
	// OK on the freshly-opened resend dialog; dispatch so its own backdrop can't intercept.
	await dispatchClick(ManageEmployeesPage.confirmResendInviteButtonCss);
};

// DELETE INVITE

export const deleteInviteButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.deleteInviteButtonCss);
};

export const clickDeleteInviteButton = async () => {
	// Toolbar Delete invite (after row selection) opens the confirm dialog; dispatch through any
	// fading selection overlay.
	await dispatchClick(ManageEmployeesPage.deleteInviteButtonCss);
};

export const confirmDeleteInviteButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.confirmDeleteInviteButtonCss);
};

export const clickConfirmDeleteInviteButton = async () => {
	// OK on the freshly-opened delete dialog; dispatch so its own backdrop can't intercept.
	await dispatchClick(ManageEmployeesPage.confirmDeleteInviteButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(ManageEmployeesPage.toastrMessageCss);
};

export const verifyEmployeeExists = async (text) => {
	await verifyText(ManageEmployeesPage.verifyEmployeeCss, text);
};

export const verifyEmployeeIsDeleted = async (text) => {
	await verifyTextNotExisting(ManageEmployeesPage.verifyEmployeeCss, text);
};

export const verifyInviteExists = async (text) => {
	await verifyText(ManageEmployeesPage.verifyInviteCss, text);
};

export const verifyInviteIsDeleted = async (text) => {
	await verifyTextNotExisting(ManageEmployeesPage.verifyInviteCss, text);
};
