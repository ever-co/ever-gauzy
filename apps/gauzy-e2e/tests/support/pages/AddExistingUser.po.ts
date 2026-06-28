import {
	verifyElementIsVisible,
	clickButton,
	clickKeyboardBtnByKeycode,
	clickElementByText,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { AddExistingUserPage } from '../../../src/support/Base/pageobjects/AddExistingUserPageObject';

export const addExistingUsersButtonVisible = async () => {
	await verifyElementIsVisible(AddExistingUserPage.addUserButtonCss);
};

export const clickAddExistingUsersButton = async () => {
	// "Add Existing" calls toggleAddCard() (showAddCard = !showAddCard), so this is a TOGGLE, not an
	// idempotent open. On the second call (right after the remove-confirmation dialog closes) the
	// users.component fires a debounced subject$ pipeline whose `tap(() => this.cancel())` sets
	// showAddCard back to false ~300ms+ later. If we toggle the card open inside that window the
	// deferred cancel() immediately closes it again and the add form (nb-select[multiple]) never
	// renders. So: (1) settle the post-remove getUsers spinner + network + a fixed wait so that
	// deferred cancel() has already run, THEN (2) toggle and poll the real form state — if the
	// nb-select didn't appear (toggle landed while card was open, or a stray cancel undid it),
	// toggle again. dispatchClick bypasses any fading cdk-overlay backdrop from the closed dialog.
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => {});
	await getPage().waitForTimeout(1500);

	const multiSelect = getPage().locator(AddExistingUserPage.usersMultiSelectCss).first();
	for (let attempt = 0; attempt < 3; attempt++) {
		await dispatchClick(AddExistingUserPage.addUserButtonCss);
		try {
			await multiSelect.waitFor({ state: 'visible', timeout: 4_000 });
			return; // card is open and the add form rendered
		} catch {
			// toggle either closed an already-open card or a deferred cancel() undid it — retry
			await getPage().waitForTimeout(500);
		}
	}
};

export const tableBodyExists = async () => {
	await verifyElementIsVisible(AddExistingUserPage.selectTableRowCss);
};

export const clickTableRow = async (text: string) => {
	// Row click TOGGLES selection (selectUser sets disableButton = !isSelected). Let the grid finish
	// loading/settling first, then click the row ONCE — a rapid second click would deselect it and
	// re-disable the toolbar remove button.
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => {});
	await getPage().waitForTimeout(1500);
	await clickElementByText(AddExistingUserPage.selectTableRowCss, text);
};

export const removeUserButtonVisible = async () => {
	await verifyElementIsVisible(AddExistingUserPage.removeUserButtonCss);
};

export const clickRemoveUserButton = async () => {
	await clickButton(AddExistingUserPage.removeUserButtonCss);
};

export const confirmRemoveUserBtnVisible = async () => {
	await verifyElementIsVisible(AddExistingUserPage.confirmRemoveUserButtonCss);
};

export const clickConfirmRemoveUserBtn = async () => {
	await clickButton(AddExistingUserPage.confirmRemoveUserButtonCss);
};

export const usersMultiSelectVisible = async () => {
	await verifyElementIsVisible(AddExistingUserPage.usersMultiSelectCss);
};

export const clickUsersMultiSelect = async () => {
	await clickButton(AddExistingUserPage.usersMultiSelectCss);
};

export const selectUsersFromDropdown = async (text: string) => {
	// The nb-select option overlay (`.option-list nb-option`) is rendered in a cdk overlay only after
	// the control opens; wait for the specific user's option to attach before clicking so we don't
	// race the overlay animation. Super Admin was just removed from the org, so it IS back in the
	// add-existing list (_loadUsers excludes only users still in this org + EMPLOYEE role).
	const option = getPage().locator(AddExistingUserPage.checkUsersMultiSelectCss).filter({ hasText: text }).first();
	await option.waitFor({ state: 'visible', timeout: 8_000 }).catch(() => {});
	await clickElementByText(AddExistingUserPage.checkUsersMultiSelectCss, text);
};

export const cancelButtonVisible = async () => {
	await verifyElementIsVisible(AddExistingUserPage.cancelAddUsersButtonCss);
};

export const clickCancelButton = async () => {
	await clickButton(AddExistingUserPage.cancelAddUsersButtonCss);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const saveUsersButtonVisible = async () => {
	await verifyElementIsVisible(AddExistingUserPage.saveSelectedUsersButtonCss);
};

export const clickSaveUsersButton = async () => {
	await clickButton(AddExistingUserPage.saveSelectedUsersButtonCss);
};
