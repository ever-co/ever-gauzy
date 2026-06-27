import {
	verifyElementIsVisible,
	clickButton,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	verifyTextNotExisting,
	waitElementToHide,
	verifyValue,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { AddEmployeeLevelPage } from '../../../src/support/Base/pageobjects/AddEmployeeLevelPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addNewLevelButtonVisible = async () => {
	await verifyElementIsVisible(AddEmployeeLevelPage.addNewLevelButtonCss);
};

export const clickAddNewLevelButton = async () => {
	// The preceding addTag CustomCommand can leave a fading "Add Tags" nb-dialog overlay mounted over
	// the employee-level page (it survives the SPA route change). A coordinate click on the toolbar Add
	// then lands on that backdrop and the add-level dialog never opens. Dismiss any leftover overlay
	// first (Escape + wait for the tags dialog to detach), then dispatch the click straight at the
	// button so it fires even if a backdrop is still fading out.
	const page = getPage();
	await page.keyboard.press('Escape').catch(() => undefined);
	await page
		.locator('ngx-tags-mutation')
		.first()
		.waitFor({ state: 'detached', timeout: 6000 })
		.catch(() => undefined);
	await verifyElementIsVisible(AddEmployeeLevelPage.addNewLevelButtonCss);
	await dispatchClick(AddEmployeeLevelPage.addNewLevelButtonCss);
};

export const cancelNewLevelButtonVisible = async () => {
	await verifyElementIsVisible(AddEmployeeLevelPage.cancelNewLevelButtonCss);
};

export const clickCancelNewLevelButton = async () => {
	await clickButton(AddEmployeeLevelPage.cancelNewLevelButtonCss);
};

export const newLevelInputVisible = async () => {
	await verifyElementIsVisible(AddEmployeeLevelPage.newLevelInputCss);
};

export const enterNewLevelData = async (data: string) => {
	await enterInput(AddEmployeeLevelPage.newLevelInputCss, data);
};

export const tagsMultiSelectVisible = async () => {
	await verifyElementIsVisible(AddEmployeeLevelPage.tagsSelectCss);
};

export const clickTagsMultiSelect = async () => {
	// #addTags is an ng-select that opens on MOUSEDOWN and is backdrop-blocked; a force-click can also
	// close the dialog. Open the panel via the keyboard instead (focus the inner input, ArrowDown).
	const input = getPage().locator(AddEmployeeLevelPage.tagsSelectCss).locator('input').first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const selectTagsFromDropdown = async (index: number) => {
	// ng-select options render in the body as div.ng-option (appendTo="body").
	await verifyElementIsVisible(AddEmployeeLevelPage.tagsSelectOptionCss);
	await getPage().locator(AddEmployeeLevelPage.tagsSelectOptionCss).nth(index).click({ force: true });
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const saveNewLevelButtonVisible = async () => {
	await verifyElementIsVisible(AddEmployeeLevelPage.updateLevelButtonCss);
};

export const clickSaveNewLevelButton = async () => {
	// Save sits in the dialog footer right after the tags mutation; dispatch the click so a fading
	// ng-select/dialog backdrop can't intercept it.
	await waitForSpinnerGone();
	await dispatchClick(AddEmployeeLevelPage.updateLevelButtonCss);
};

export const editEmployeeLevelButtonVisible = async () => {
	await verifyElementIsVisible(AddEmployeeLevelPage.editEmployeeLevelButtonCss);
};

// Select a grid row so the toolbar Edit/Delete buttons enable (Edit is [disabled] until selectEmployee
// runs). The row click TOGGLES selection, so settle the grid first, click ONCE, then poll the Edit
// button's real disabled attr and only re-click if selection was lost.
export const selectEmployeeLevelRow = async () => {
	const page = getPage();
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const row = page.locator(AddEmployeeLevelPage.selectEmployeeLevelRow).first();
	const edit = page.locator(AddEmployeeLevelPage.editEmployeeLevelButtonCss).first();
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

// Select a SPECIFIC row by its level text (delete step has 2 rows; we must select the right one so the
// subsequent verifyElementIsDeleted checks the level we actually removed). Same toggle-safe poll as above.
export const selectEmployeeLevelRowByText = async (text: string) => {
	const page = getPage();
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const row = page.locator(AddEmployeeLevelPage.selectEmployeeLevelRow).filter({ hasText: text }).first();
	const edit = page.locator(AddEmployeeLevelPage.editEmployeeLevelButtonCss).first();
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

export const clickRowEmployeeLevel = async () => {
	await selectEmployeeLevelRow();
};

export const clickRowEmployeeLevelToDelete = async () => {
	await selectEmployeeLevelRow();
};

export const clickEditEmployeeLevelButton = async () => {
	await dispatchClick(AddEmployeeLevelPage.editEmployeeLevelButtonCss);
};

export const editEmployeeLevelInpuVisible = async () => {
	await verifyElementIsVisible(AddEmployeeLevelPage.editLevelInputCss);
};

export const enterEditLevelData = async (data: string) => {
	await clearField(AddEmployeeLevelPage.editLevelInputCss);
	await enterInput(AddEmployeeLevelPage.editLevelInputCss, data);
};

export const deleteLevelButtonVisible = async () => {
	await verifyElementIsVisible(AddEmployeeLevelPage.removeEmployeeLevelButtonCss);
};

export const clickDeleteLevelButton = async () => {
	await dispatchClick(AddEmployeeLevelPage.removeEmployeeLevelButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(AddEmployeeLevelPage.confirmDeleteLevelButtonCss);
};

export const clickConfirmDeleteLevelButton = async () => {
	await dispatchClick(AddEmployeeLevelPage.confirmDeleteLevelButtonCss);
};

export const verifyTitleExists = async (text: string) => {
	await verifyValue(AddEmployeeLevelPage.editLevelInputCss, text);
};

export const verifyElementIsDeleted = async (text: string) => {
	await verifyTextNotExisting(AddEmployeeLevelPage.verifyTextCss, text);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(AddEmployeeLevelPage.toastrMessageCss);
};

export const cancelButtonVisible = async () => {
	await verifyElementIsVisible(AddEmployeeLevelPage.cancelButtonCss);
};

export const clickCancelButton = async () => {
	// Cancel sits in the open dialog footer; dispatch so a fading backdrop can't swallow the click.
	await dispatchClick(AddEmployeeLevelPage.cancelButtonCss);
};
