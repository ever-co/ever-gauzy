import {
	verifyElementIsVisible,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	verifyTextNotExisting,
	getLastElement,
	waitElementToHide,
	verifyValue,
	dispatchClick,
	waitForSpinnerGone,
	wait
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { AddEmployeePositionPage } from '../../../src/support/Base/pageobjects/AddEmployeePositionPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addNewPositionButtonVisible = async () => {
	await verifyElementIsVisible(AddEmployeePositionPage.addNewPositionButtonCss);
};

export const clickAddNewPositionButton = async () => {
	// The preceding addTag CustomCommand can leave the "Add Tags" nb-dialog mounted over the positions
	// page with its backdrop STILL showing (the tag Save stays disabled when the form is invalid, so the
	// dialog never auto-closes, and it survives the SPA route change). That backdrop intercepts the
	// toolbar Add click and the add-position dialog never opens. A plain page.keyboard Escape does NOT
	// dismiss it after a goto() because focus is on <body>, not the overlay, so NbDialog's closeOnEsc
	// keydown handler never fires. Instead dispatch a click straight at the tags dialog's own close
	// control (its Cancel button / X icon both call closeDialog()), which fires regardless of focus or a
	// fading backdrop, and retry until ngx-tags-mutation detaches (mirrors the proven AddEmployeeLevel
	// flow) before clicking Add.
	const page = getPage();
	const tagsDialog = page.locator('ngx-tags-mutation').first();
	for (let i = 0; i < 4; i++) {
		if ((await tagsDialog.count()) === 0) break;
		// Cancel button (status="basic" outline) and the X icon both call closeDialog().
		await dispatchClick('ngx-tags-mutation nb-card-footer button[status="basic"]').catch(() => undefined);
		await dispatchClick('ngx-tags-mutation .cancel i').catch(() => undefined);
		await page.keyboard.press('Escape').catch(() => undefined);
		await tagsDialog.waitFor({ state: 'detached', timeout: 3000 }).catch(() => undefined);
	}
	await verifyElementIsVisible(AddEmployeePositionPage.addNewPositionButtonCss);
	await dispatchClick(AddEmployeePositionPage.addNewPositionButtonCss);
	// Confirm the add-position dialog actually opened; if a fading backdrop swallowed the first dispatch,
	// re-dispatch once. The caller's newPositionInputVisible() then asserts the Position name input.
	const opened = await page
		.locator(AddEmployeePositionPage.newPositionInputCss)
		.first()
		.waitFor({ state: 'visible', timeout: 6000 })
		.then(() => true)
		.catch(() => false);
	if (!opened) {
		await dispatchClick(AddEmployeePositionPage.addNewPositionButtonCss);
	}
};

export const cancelNewPositionButtonVisible = async () => {
	await verifyElementIsVisible(AddEmployeePositionPage.cancelNewPositionButtonCss);
};

export const clickCancelNewPositionButton = async () => {
	await dispatchClick(AddEmployeePositionPage.cancelNewPositionButtonCss);
};

export const newPositionInputVisible = async () => {
	await verifyElementIsVisible(AddEmployeePositionPage.newPositionInputCss);
};

export const enterNewPositionData = async (data: string) => {
	await enterInput(AddEmployeePositionPage.newPositionInputCss, data);
};

export const tagsMultiSelectVisible = async () => {
	await verifyElementIsVisible(AddEmployeePositionPage.tagsSelectCss);
};

export const clickTagsMultiSelect = async () => {
	// #addTags is an ng-select that opens on MOUSEDOWN and is backdrop-blocked; a force-click can also
	// close the dialog. Open the panel via the keyboard instead (focus the inner input, ArrowDown).
	const input = getPage().locator(AddEmployeePositionPage.tagsSelectCss).locator('input').first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const selectTagsFromDropdown = async (index: number) => {
	// ng-select options render in the body as div.ng-option (appendTo="body").
	await verifyElementIsVisible(AddEmployeePositionPage.tagsSelectOptionCss);
	await getPage().locator(AddEmployeePositionPage.tagsSelectOptionCss).nth(index).click({ force: true });
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const savePositionButtonVisible = async () => {
	await verifyElementIsVisible(AddEmployeePositionPage.saveNewPositionButtonCss);
};

export const clickSavePositionButton = async () => {
	// Save sits in the dialog footer right after the tags mutation; dispatch the click so a fading
	// ng-select/dialog backdrop can't intercept it.
	await waitForSpinnerGone();
	await dispatchClick(AddEmployeePositionPage.saveNewPositionButtonCss);
};

export const updatePositionButtonVisible = async () => {
	await verifyElementIsVisible(AddEmployeePositionPage.updatePositionButtonCss);
};

export const clickUpdatePositionButton = async () => {
	await dispatchClick(AddEmployeePositionPage.updatePositionButtonCss);
};

export const editEmployeePositionButtonVisible = async () => {
	await verifyElementIsVisible(AddEmployeePositionPage.editEmployeePositionButtonCss);
};

// Select a grid row so the toolbar Edit/Delete buttons enable (Edit is [disabled] until selectPosition
// runs). The row click TOGGLES selection, so settle the grid first, click ONCE, then poll the Edit
// button's real disabled attr and only re-click if selection was lost.
export const selectPositionRow = async () => {
	const page = getPage();
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const row = page.locator(AddEmployeePositionPage.selectPositionToEditCss).first();
	const edit = page.locator(AddEmployeePositionPage.editEmployeePositionButtonCss).first();
	await row.click({ force: true });
	for (let i = 0; i < 5; i++) {
		const disabled = await edit.getAttribute('disabled');
		if (disabled === null) return;
		await page.waitForTimeout(500);
		if ((await edit.getAttribute('disabled')) !== null) {
			await row.click({ force: true });
		}
	}
};

// Select a SPECIFIC row by its name text (the delete step has 2 rows; we must select the right one so
// the subsequent verifyElementIsDeleted checks the position we actually removed). Same toggle-safe poll.
export const selectPositionRowByText = async (text: string) => {
	const page = getPage();
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const row = page.locator(AddEmployeePositionPage.selectPositionToEditCss).filter({ hasText: text }).first();
	const edit = page.locator(AddEmployeePositionPage.editEmployeePositionButtonCss).first();
	await row.click({ force: true });
	for (let i = 0; i < 5; i++) {
		const disabled = await edit.getAttribute('disabled');
		if (disabled === null) return;
		await page.waitForTimeout(500);
		if ((await edit.getAttribute('disabled')) !== null) {
			await row.click({ force: true });
		}
	}
};

export const clickEditEmployeePositionButton = async () => {
	// Edit dialog opens via dispatch so a fading backdrop can't swallow the click (row already selected).
	await dispatchClick(AddEmployeePositionPage.editEmployeePositionButtonCss);
};

export const selectPositionToEdit = async () => {
	await getLastElement(AddEmployeePositionPage.selectPositionToEditCss);
};

export const selectPositionToDelete = async () => {
	await getLastElement(AddEmployeePositionPage.selectPositionToDeleteCss);
};

export const clickRowEmployeeLevelTwice = async () => {
	await wait(500);
	await selectPositionRow();
};

export const editEmployeePositionInputVisible = async () => {
	await verifyElementIsVisible(AddEmployeePositionPage.editPositionInputCss);
};

export const enterEditPositionData = async (data: string) => {
	await clearField(AddEmployeePositionPage.editPositionInputCss);
	await enterInput(AddEmployeePositionPage.editPositionInputCss, data);
};

export const deletePositionButtonVisible = async () => {
	await verifyElementIsVisible(AddEmployeePositionPage.removeEmployeePositionButtonCss);
};

export const clickDeletePositionButton = async () => {
	// Delete opens its confirmation via dispatch (row already selected by the caller).
	await dispatchClick(AddEmployeePositionPage.removeEmployeePositionButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(AddEmployeePositionPage.confirmDeletePositionButtonCss);
};

export const clickConfirmDeletePositionButton = async () => {
	await dispatchClick(AddEmployeePositionPage.confirmDeletePositionButtonCss);
};

export const verifyTitleExists = async (text: string) => {
	await verifyValue(AddEmployeePositionPage.editPositionInputCss, text);
};

export const verifyElementIsDeleted = async (text: string) => {
	await verifyTextNotExisting(AddEmployeePositionPage.verifyTextCss, text);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(AddEmployeePositionPage.toastrMessageCss);
};

export const cancelButtonVisible = async () => {
	await verifyElementIsVisible(AddEmployeePositionPage.cancelButtonCss);
};

export const clickCancelButton = async () => {
	// Cancel sits in the open dialog footer; dispatch so a fading backdrop can't swallow the click.
	await dispatchClick(AddEmployeePositionPage.cancelButtonCss);
};
