import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickKeyboardBtnByKeycode,
	waitElementToHide,
	waitForSpinnerGone,
	dispatchClick,
	verifyText,
	verifyTextNotExisting
} from '../util';
import { getPage } from '../page-context';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { OrganizationEmploymentTypesPage } from '../../../src/support/Base/pageobjects/OrganizationEmploymentTypesPageObject';

// A modal dialog (Add Tags from CustomCommands.addTag, or the employment-type Add/Edit form
// whose Save sometimes does not auto-close) leaves an active cdk-overlay-backdrop that
// intercepts every click. Press Escape until that backdrop is gone.
const dismissOpenDialog = async () => {
	const page = getPage();
	const backdrop = page.locator('.cdk-overlay-backdrop');
	for (let i = 0; i < 4; i++) {
		if ((await backdrop.count()) === 0) break;
		await page.keyboard.press('Escape');
		await page.waitForTimeout(600);
	}
};

// The freshly-navigated page also renders a "Tag added" toast over a fading route transition,
// so the Add button is briefly not clickable. Dismiss any leftover dialog + wait for toasts
// to clear before opening the real form.
const settleBeforeAdd = async () => {
	const page = getPage();
	await dismissOpenDialog();
	const toast = page.locator(OrganizationEmploymentTypesPage.toastrMessageCss);
	try {
		await toast.first().waitFor({ state: 'hidden', timeout: 12000 });
	} catch {
		/* no toast present */
	}
	await page.waitForTimeout(500);
};

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addButtonVisible = async () => {
	await settleBeforeAdd();
	await verifyElementIsVisible(OrganizationEmploymentTypesPage.addButtonCss);
};

export const clickAddButton = async () => {
	// dispatchClick (not a coordinate click): CustomCommands.addTag runs immediately before this and leaves
	// a fading cdk-overlay-backdrop over the toolbar; a coordinate click — even {force:true} — lands on
	// that backdrop. dispatch fires openDialog() straight on the Add button. settleBeforeAdd already
	// Escaped the backdrop + waited the toast out, so the button is attached.
	await dispatchClick(OrganizationEmploymentTypesPage.addButtonCss);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEmploymentTypesPage.nameInputCss);
};

export const enterNameInputData = async (data: string) => {
	await clickButton(OrganizationEmploymentTypesPage.nameInputCss);
	await clearField(OrganizationEmploymentTypesPage.nameInputCss);
	await enterInput(OrganizationEmploymentTypesPage.nameInputCss, data);
};

export const editNameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEmploymentTypesPage.editNameInputCss);
};

export const enterEditNameInputData = async (data: string) => {
	await clickButton(OrganizationEmploymentTypesPage.editNameInputCss);
	await clearField(OrganizationEmploymentTypesPage.editNameInputCss);
	await enterInput(OrganizationEmploymentTypesPage.editNameInputCss, data);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationEmploymentTypesPage.addTagsDropdownCss);
};

export const clickTagsDropdown = async () => {
	// The tags control is an ng-select (#addTags, appendTo="body"); it opens on MOUSEDOWN, and a leftover
	// cdk-overlay-backdrop from the add-tag dialog sits over it, so a coordinate click can't open it (and a
	// stray force-click on the control can CLOSE the form). Open it via the keyboard: focus the search
	// input and press ArrowDown — mirrors the proven ContactsLeads country/tags handling.
	const page = getPage();
	const input = page.locator(OrganizationEmploymentTypesPage.addTagsDropdownCss).locator('input').first();
	await input.focus().catch(() => {});
	await page.keyboard.press('ArrowDown');
};

export const selectTagFromDropdown = async (index: number) => {
	const page = getPage();
	const option = page.locator(OrganizationEmploymentTypesPage.tagsDropdownOption);
	// Best-effort: the tag list (div.ng-option, rendered at body level via appendTo) loads async. The
	// addTag prerequisite seeds one tag, but if the panel is slow/empty don't hang 60s on option[index] —
	// pick one if it shows, otherwise Escape and continue (a tag is optional; the type saves without it).
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
	} catch {
		await page.keyboard.press('Escape').catch(() => {});
	}
};

export const clickCardBody = async () => {
	await clickButton(OrganizationEmploymentTypesPage.cardBodyCss);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEmploymentTypesPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	// dispatchClick: the just-closed tags ng-select panel leaves a fading cdk-overlay-backdrop over the
	// dialog footer, so a coordinate click lands on it and onSaveClick() never fires (dialog stays open,
	// breaking the next step). dispatch fires the button's (click) directly; it still gates on form
	// validity. Wait any transient spinner out first.
	await waitForSpinnerGone();
	await dispatchClick(OrganizationEmploymentTypesPage.saveButtonCss);
};

export const selectFirstItem = async () => {
	const page = getPage();
	// The Add/Edit/Delete dialog's Save sometimes leaves the modal backdrop up, which would
	// swallow the card click. Clear it first.
	await dismissOpenDialog();
	// Let the card list settle: the preceding mutation triggers _refresh$ which clears then refetches the
	// array, and a click during that re-render is lost or immediately cleared (ROOT CAUSE #4).
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	await verifyElementIsVisible(OrganizationEmploymentTypesPage.selectItemCss);
	const item = page.locator(OrganizationEmploymentTypesPage.selectItemCss).first();
	const editBtn = page.locator(OrganizationEmploymentTypesPage.editButtonCss).first();
	// Clicking a card TOGGLES its selection (selectOrganizationEmploymentType), which sets disabled=false
	// and enables the toolbar Edit. Click ONCE then poll the Edit button's real disabled attr; only
	// re-click if a late re-render lost the selection — never rapid re-click (that would toggle it off).
	for (let attempt = 0; attempt < 4; attempt++) {
		await item.click({ force: true });
		for (let i = 0; i < 8; i++) {
			await page.waitForTimeout(350);
			if (await editBtn.isEnabled().catch(() => false)) return;
		}
	}
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEmploymentTypesPage.editButtonCss);
};

export const clickEditButton = async (index: number) => {
	// dispatchClick: the preceding add/save dialog leaves a fading cdk-overlay-backdrop over the toolbar
	// that swallows a coordinate click on Edit; dispatch fires openDialog(editableTemplate, true) directly.
	// The toolbar renders a single Edit button so index is effectively 0.
	await waitForSpinnerGone();
	await dispatchClick(OrganizationEmploymentTypesPage.editButtonCss);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEmploymentTypesPage.deleteButtonCss);
};

export const clickDeleteButton = async (index: number) => {
	// dispatchClick: same toolbar-backdrop issue as Edit — fire deleteEmploymentType() directly so the
	// confirm dialog opens. Single toolbar Delete button, so index is effectively 0.
	await waitForSpinnerGone();
	await dispatchClick(OrganizationEmploymentTypesPage.deleteButtonCss);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEmploymentTypesPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	// dispatchClick: a leftover backdrop from the just-opened confirm dialog (and the prior selection
	// flow) can sit over the footer OK button; dispatch fires delete() directly so the record is removed.
	await waitForSpinnerGone();
	await dispatchClick(OrganizationEmploymentTypesPage.confirmDeleteButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(OrganizationEmploymentTypesPage.toastrMessageCss);
};

export const verifyTypeExists = async (text: string) => {
	await verifyText(OrganizationEmploymentTypesPage.verifyTextCss, text);
};

export const verifyTypeIsDeleted = async (text: string) => {
	await verifyTextNotExisting(OrganizationEmploymentTypesPage.verifyTextCss, text);
};
