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
	getLastElement,
	waitElementToHide,
	verifyText,
	verifyElementNotExist,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { CandidatesPage } from '../../../src/support/Base/pageobjects/CandidatesPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const inviteButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.inviteButtonCss);
};

export const clickInviteButton = async () => {
	// Toolbar Invite -> invite() opens the dialog. The button lives in an animated transition
	// container; let the page settle then dispatch so a mid-transition coordinate click can't miss.
	await waitForSpinnerGone();
	await dispatchClick(CandidatesPage.inviteButtonCss);
};

export const emailInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.emailInputCss);
};

export const enterEmailData = async (data) => {
	await enterInputConditionally(CandidatesPage.emailInputCss, data);
};

export const inviteDateInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.dateInputCss);
};

export const enterInviteDateInputData = async () => {
	await clearField(CandidatesPage.dateInputCss);
	const date = dayjs().format('MMM D, YYYY');
	await enterInput(CandidatesPage.dateInputCss, date);
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const selectTableRowVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.selectTableRowCss);
};

export const selectTableRow = async (index) => {
	// Selecting a grid row TOGGLES selection and enables the toolbar (Edit/Archive/Reject). Settle
	// the grid first, then click ONCE and poll the Edit button's real `disabled` attr — only
	// re-click if selection was lost. Never rapid re-click (that toggles it back off).
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => {});
	await getPage().waitForTimeout(1500);
	const row = getPage().locator(CandidatesPage.selectTableRowCss).nth(index);
	const editBtn = getPage().locator(CandidatesPage.editButtonCss).first();
	await row.click({ force: true });
	for (let i = 0; i < 5; i++) {
		const disabled = await editBtn.getAttribute('disabled');
		if (disabled === null) return; // enabled -> row is selected
		await getPage().waitForTimeout(500);
		if (i === 2) await row.click({ force: true }); // one re-click if still not selected
	}
};

export const sendInviteButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.sendInviteButtonCss);
};

export const clickSendInviteButton = async () => {
	// Invite is submitted right after the appliedDate nb-datepicker mutation; its fading
	// cdk-overlay-backdrop sits over the footer and swallows a coordinate (force) click, so the
	// dialog never closes. dispatchClick fires (click)="add()" straight on the element.
	await dispatchClick(CandidatesPage.sendInviteButtonCss);
};

export const addCandidateButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.addButtonCss);
};

export const clickAddCandidateButton = async (index) => {
	// Clicked right after the invite dialog closed (its backdrop + toastr still fading over the
	// toolbar); a coordinate click lands on the overlay. Settle, then dispatch (click)="add()".
	await waitForSpinnerGone();
	await dispatchClick(CandidatesPage.addButtonCss);
};

export const firstNameInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.firstNameInputCss);
};

export const enterFirstNameInputData = async (data) => {
	await clearField(CandidatesPage.firstNameInputCss);
	await enterInput(CandidatesPage.firstNameInputCss, data);
};

export const lastNameInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.lastNameInputCss);
};

export const enterLastNameInputData = async (data) => {
	await clearField(CandidatesPage.lastNameInputCss);
	await enterInput(CandidatesPage.lastNameInputCss, data);
};

export const usernameInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.usernameInputCss);
};

export const enterUsernameInputData = async (data) => {
	await clearField(CandidatesPage.usernameInputCss);
	await enterInput(CandidatesPage.usernameInputCss, data);
};

export const candidateEmailInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.newCandidateEmailInputCss);
};

export const enterCandidateEmailInputData = async (data) => {
	await clearField(CandidatesPage.newCandidateEmailInputCss);
	await enterInput(CandidatesPage.newCandidateEmailInputCss, data);
};

export const passwordInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.passwordInputCss);
};

export const enterPasswordInputData = async (data) => {
	await clearField(CandidatesPage.passwordInputCss);
	await enterInput(CandidatesPage.passwordInputCss, data);
};

export const candidateDateInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.newCandidateDateInputCss);
};

export const enterCandidateDateInputData = async () => {
	await clearField(CandidatesPage.newCandidateDateInputCss);
	const date = dayjs().format('MMM D, YYYY');
	await enterInput(CandidatesPage.newCandidateDateInputCss, date);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.addTagsDropdownCss);
};

export const clickAddTagsDropdown = async () => {
	// ga-tags-color-input is an ng-select that opens on MOUSEDOWN and is backdrop-blocked; a
	// force-click on its control can also CLOSE the add form. Open it via the keyboard instead.
	const input = getPage().locator(CandidatesPage.addTagsDropdownCss).locator('input').first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const selectTagsFromDropdown = async (index) => {
	await clickButtonByIndex(CandidatesPage.tagsDropdownOption, index);
};

export const imageInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.imageInputCss);
};

export const enterImageInputData = async (data) => {
	await enterInput(CandidatesPage.imageInputCss, data);
};

export const nextButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.nextButtonCss);
};

export const clickNextButton = async () => {
	// Stepper step-1 -> step-2. The tags ng-select dropdown we just opened (appendTo body) leaves a
	// fading overlay over the footer; dispatch the click straight on the nbStepperNext button.
	await waitForSpinnerGone();
	await dispatchClick(CandidatesPage.nextButtonCss);
};

export const nextStepButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.nextStepButtonCss);
};

export const clickNextStepButton = async () => {
	// Stepper step-2 -> step-3 (nbStepperNext); same backdrop hazard as step-1's Next.
	await waitForSpinnerGone();
	await dispatchClick(CandidatesPage.nextStepButtonCss);
};

export const allCurrentCandidatesButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.allCurrentCandidatesButtonCss);
};

export const clickAllCurrentCandidatesButton = async () => {
	// Stepper step-3 "Finished adding" -> (click)="add()" persists the candidate and closes the
	// dialog; dispatch through any lingering stepper/overlay backdrop.
	await waitForSpinnerGone();
	await dispatchClick(CandidatesPage.allCurrentCandidatesButtonCss);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.selectTableRowCss);
};

export const selectLastTableRow = async () => {
	await getLastElement(CandidatesPage.selectTableRowCss);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.editButtonCss);
};

export const includeArchiveButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.checkboxButtonCss);
};

export const clickIncludeArchiveButton = async () => {
	await clickButton(CandidatesPage.checkboxButtonCss);
};

export const clickEditButton = async () => {
	// Toolbar Edit fires after row selection; dispatch so a fading selection/overlay can't swallow it.
	await dispatchClick(CandidatesPage.editButtonCss);
};

export const archiveButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.archiveButtonCss);
};

export const clickArchiveButton = async () => {
	// Toolbar Archive opens the confirm dialog; dispatch through any fading selection overlay.
	await dispatchClick(CandidatesPage.archiveButtonCss);
};

export const rejectButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.rejectButtonCss);
};

export const clickRejectButton = async () => {
	// Toolbar Reject opens the confirm dialog; dispatch through any fading selection overlay.
	await dispatchClick(CandidatesPage.rejectButtonCss);
};

export const locationButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.locationButtonCss);
};

export const clickLocationButton = async () => {
	await clickButton(CandidatesPage.locationButtonCss);
};

export const countryDropdownVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.countryDropdownCss);
};

export const clickCountryDropdown = async () => {
	await clickButton(CandidatesPage.countryDropdownCss);
};

export const selectCountryFromDropdown = async (text) => {
	await clickElementByText(CandidatesPage.selectDropdownOptionCss, text);
};

export const cityInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.cityInputCss);
};

export const enterCityInputData = async (data) => {
	await clearField(CandidatesPage.cityInputCss);
	await enterInput(CandidatesPage.cityInputCss, data);
};

export const addressOneInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.addressOneInputCss);
};

export const enterAddressOneInputData = async (data) => {
	await clearField(CandidatesPage.addressOneInputCss);
	await enterInput(CandidatesPage.addressOneInputCss, data);
};

export const postcodeInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.postCodeInputCss);
};

export const enterPostcodeInputData = async (data) => {
	await clearField(CandidatesPage.postCodeInputCss);
	await enterInput(CandidatesPage.postCodeInputCss, data);
};

export const saveActionButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.saveActionButtonCss);
};

export const clickSaveActionButton = async () => {
	await clickButton(CandidatesPage.saveActionButtonCss);
};

export const backButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.backButtonCss);
};

export const clickBackButton = async () => {
	// Clicked right after the edit Save toast; dispatch through any lingering overlay.
	await dispatchClick(CandidatesPage.backButtonCss);
};

export const saveEditButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.saveEditButtonCss);
};

export const clickSaveEditButton = async () => {
	// Edit-page Save (type="submit", disabled while form invalid). Let the page settle, then
	// dispatch so the (ngSubmit) fires even with a transient overlay/spinner.
	await waitForSpinnerGone();
	await dispatchClick(CandidatesPage.saveEditButtonCss);
};

export const ratesButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.ratesButtonCss);
};

export const clickRatesButton = async () => {
	await clickButton(CandidatesPage.ratesButtonCss);
};

export const payPeriodDropdownVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.payPeriodDropdownCss);
};

export const clickPayPeriodDropdown = async () => {
	await clickButton(CandidatesPage.payPeriodDropdownCss);
};

export const selectPayPeriodFromDropdown = async (text) => {
	await clickElementByText(CandidatesPage.selectDropdownOptionCss, text);
};

export const billRateInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.billRateInputCss);
};

export const enterBillRateInputData = async (data) => {
	await clearField(CandidatesPage.billRateInputCss);
	await enterInput(CandidatesPage.billRateInputCss, data);
};

export const saveBillRateButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.saveActionButtonCss);
};

export const clickSaveBillRateButton = async () => {
	await clickButton(CandidatesPage.saveActionButtonCss);
};

export const experienceButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.experienceButtonCss);
};

export const clickExperienceButton = async () => {
	await clickButton(CandidatesPage.experienceButtonCss);
};

export const addExperienceButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.addExperienceButtonCss);
};

export const clickAddExperienceButton = async () => {
	await clickButton(CandidatesPage.addExperienceButtonCss);
};

export const schoolNameInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.schoolNameInputCss);
};

export const enterSchoolNameInputData = async (data) => {
	await clearField(CandidatesPage.schoolNameInputCss);
	await enterInput(CandidatesPage.schoolNameInputCss, data);
};

export const degreeInputVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.degreeInputCss);
};

export const enterDegreeInputData = async (data) => {
	await clearField(CandidatesPage.degreeInputCss);
	await enterInput(CandidatesPage.degreeInputCss, data);
};

export const saveExperienceButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.saveExperienceButtonCss);
};

export const clickSaveExperienceButton = async () => {
	await clickButton(CandidatesPage.saveExperienceButtonCss);
};

export const confirmActionButtonVisible = async () => {
	await verifyElementIsVisible(CandidatesPage.confirmActionButtonCss);
};

export const clickConfirmActionButton = async () => {
	// OK button on the reject/archive confirm dialog; dispatch so the freshly-opened dialog's own
	// backdrop (or the previous toolbar overlay) can't intercept the coordinate click.
	await dispatchClick(CandidatesPage.confirmActionButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(CandidatesPage.toastrMessageCss);
};

export const verifyCandidateExists = async (text) => {
	await verifyText(CandidatesPage.verifyCandidateCss, text);
};

export const verifyElementIsDeleted = async () => {
	await verifyElementNotExist(CandidatesPage.verifyCandidateCss);
};

export const verifyBadgeClass = async () => {
	await verifyElementIsVisible(CandidatesPage.badgeCss);
};
