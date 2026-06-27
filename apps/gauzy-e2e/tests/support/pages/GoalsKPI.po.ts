import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickButtonByIndex,
	waitElementToHide,
	verifyText,
	verifyByLength,
	verifyTextNotExisting,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { GoalsKPIPage } from '../../../src/support/Base/pageobjects/GoalsKPIPageObject';

// The preceding CustomCommands.addEmployee quick-add can leave its ga-employee-mutation dialog open
// (its step-1 form stays invalid, so the dialog never closes). That dialog's cdk-overlay-backdrop
// survives the SPA hash navigation to /pages/goals/settings and intercepts every coordinate click,
// so the KPI-tab click (force or not) lands on the backdrop and the tab never switches — leaving the
// Add KPI button (rendered only on the KPI tab) absent. Dismiss any lingering dialog before driving
// the settings page so the tab switch actually takes. Best-effort: Escape + wait for detach.
const dismissLeftoverDialog = async () => {
	const page = getPage();
	const dialog = page.locator('ga-employee-mutation').first();
	if (await dialog.isVisible().catch(() => false)) {
		await page.keyboard.press('Escape').catch(() => undefined);
		await dialog.waitFor({ state: 'detached', timeout: 6000 }).catch(() => undefined);
	}
	// Wait out any fading cdk backdrop left behind by the dismissed dialog.
	await page
		.locator('.cdk-overlay-backdrop')
		.first()
		.waitFor({ state: 'detached', timeout: 4000 })
		.catch(() => undefined);
};

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const tabButtonVisible = async () => {
	await verifyElementIsVisible(GoalsKPIPage.tabButtonCss);
};

export const clickTabButton = async (index) => {
	// Clear any leftover modal backdrop from the preceding addEmployee step, then dispatch the tab
	// click straight to the <li> so it fires even if a fading backdrop is still on top (a coordinate
	// click — even force — would land on the backdrop and the tab would never switch).
	await dismissLeftoverDialog();
	await getPage().locator(GoalsKPIPage.tabButtonCss).nth(index).dispatchEvent('click');
	await getPage().waitForTimeout(1000);
};

export const addKPIButtonVisible = async () => {
	await verifyElementIsVisible(GoalsKPIPage.addKPIButtonCss);
};

export const clickAddKPIButton = async () => {
	// dispatchClick: a residual backdrop from the addEmployee dialog can still intercept a coordinate
	// click on the toolbar Add button; dispatch the event directly to fire editKPI('add').
	await dispatchClick(GoalsKPIPage.addKPIButtonCss);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(GoalsKPIPage.kpiTitleInputCss);
};

export const enterNameInputData = async (data) => {
	await clearField(GoalsKPIPage.kpiTitleInputCss);
	await enterInput(GoalsKPIPage.kpiTitleInputCss, data);
};

export const descriptionInputVisible = async () => {
	await verifyElementIsVisible(GoalsKPIPage.kpiDescriptionInputCss);
};

export const enterDescriptionInputData = async (data) => {
	await clearField(GoalsKPIPage.kpiDescriptionInputCss);
	await enterInput(GoalsKPIPage.kpiDescriptionInputCss, data);
};

export const employeeMultiSelectVisible = async () => {
	await verifyElementIsVisible(GoalsKPIPage.employeeMultiSelectCss);
};

export const clickEmployeeMultiSelect = async () => {
	await clickButton(GoalsKPIPage.employeeMultiSelectCss);
};

export const employeeDropdownVisible = async () => {
	await verifyElementIsVisible(GoalsKPIPage.employeeDropdownCss);
};

export const selectEmployeeFromDropdown = async (index) => {
	await clickButtonByIndex(GoalsKPIPage.employeeDropdownCss, index);
};

export const valueInputVisible = async () => {
	await verifyElementIsVisible(GoalsKPIPage.currentValueInputCss);
};

export const enterValueInputData = async (data) => {
	await clearField(GoalsKPIPage.currentValueInputCss);
	await enterInput(GoalsKPIPage.currentValueInputCss, data);
};

export const saveKPIButtonVisible = async () => {
	await verifyElementIsVisible(GoalsKPIPage.saveKPIButtonCss);
};

export const clickSaveKPIButton = async () => {
	// Save closes the KPI dialog (and the form may briefly show a spinner); dispatch the click so it
	// fires even with the dialog's own fading backdrop in play.
	await waitForSpinnerGone();
	await dispatchClick(GoalsKPIPage.saveKPIButtonCss);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(GoalsKPIPage.selectTableRowCss);
};

export const selectTableRow = async (index) => {
	// A smart-table row click TOGGLES selection, which enables the toolbar Edit/Delete buttons. Settle
	// the grid first (the KPI save just closed its dialog), click the row ONCE, then poll the Edit
	// button's real disabled attr; only re-click if selection was lost. Never rapid re-click.
	const page = getPage();
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const row = page.locator(GoalsKPIPage.selectTableRowCss).nth(index);
	const editBtn = page.locator(GoalsKPIPage.editButtonCss).first();
	await row.click({ force: true, timeout: 60_000 });
	for (let i = 0; i < 6; i++) {
		const disabled = await editBtn.getAttribute('disabled').catch(() => '');
		if (disabled === null) return; // attribute absent => enabled => row is selected
		await page.waitForTimeout(500);
		const stillDisabled = await editBtn.getAttribute('disabled').catch(() => '');
		if (stillDisabled === null) return;
		if (i === 2) await row.click({ force: true, timeout: 60_000 }); // single re-click halfway
	}
};

export const editKPIButtonVisible = async () => {
	await verifyElementIsVisible(GoalsKPIPage.editButtonCss);
};

export const clickEditKPIButton = async () => {
	// Toolbar Edit opens the KPI dialog; dispatch the click to bypass any fading backdrop.
	await dispatchClick(GoalsKPIPage.editButtonCss);
};

export const deleteKPIButtonVisible = async () => {
	await verifyElementIsVisible(GoalsKPIPage.deleteButtonCss);
};

export const clickDeleteKPIButton = async () => {
	// Toolbar Delete opens the confirm dialog; dispatch the click to bypass any fading backdrop.
	await dispatchClick(GoalsKPIPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(GoalsKPIPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	// Confirm-delete button sits in the AlertModal dialog footer; dispatch the click so the
	// confirmation fires even with the dialog's backdrop fading in.
	await dispatchClick(GoalsKPIPage.confirmDeleteButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(GoalsKPIPage.toastrMessageCss);
};

export const verifyElementDeleted = async (text) => {
	// Verify the deleted KPI is gone by name rather than asserting the grid's no-data string: the
	// app's KPI empty message is "You have not created any KPIs." (not "No data found"), and on a
	// shared/polluted stack other KPIs may remain so the table isn't actually empty. Asserting the
	// specific name row is absent matches the true delete intent and is pollution-resilient.
	await verifyTextNotExisting(GoalsKPIPage.verifyKPICss, text);
};

export const verifyKPIExists = async (text) => {
	await verifyText(GoalsKPIPage.verifyKPICss, text);
};

export const verifyNameInput = async () => {
	await verifyElementIsVisible(GoalsKPIPage.searchNameInputCss);
};

export const searchClientName = async (name: string) => {
	await clearField(GoalsKPIPage.searchNameInputCss);
	await enterInput(GoalsKPIPage.searchNameInputCss, name);
};

export const verifySearchResult = async (length: number) => {
	await verifyByLength(GoalsKPIPage.selectTableRowCss, length);
};
