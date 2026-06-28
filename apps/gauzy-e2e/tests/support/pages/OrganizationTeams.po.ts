import {
	verifyElementIsVisible,
	clickButtonByIndex,
	clickButton,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	waitElementToHide,
	verifyText,
	verifyTextNotExisting,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { OrganizationTeamsPage } from '../../../src/support/Base/pageobjects/OrganizationTeamsPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addTeamButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.addTeamButtonCss);
};

export const clickAddTeamButton = async () => {
	// Clicked right after the addTag prerequisite: a leftover/re-opened "Add Tags" nb-dialog can still
	// be mounted with its cdk backdrop intercepting the toolbar "Add" so ga-teams-mutation never opens.
	// Dismiss any leftover tags dialog, dispatch the Add click (bypasses the fading backdrop), then
	// confirm the team mutation form opened — retry the click once if it didn't.
	const page = getPage();
	for (let i = 0; i < 3 && (await page.locator('ngx-tags-mutation').count()) > 0; i++) {
		await page.keyboard.press('Escape').catch(() => undefined);
		await page.locator('ngx-tags-mutation').first().waitFor({ state: 'detached', timeout: 4000 }).catch(() => undefined);
	}
	await waitForSpinnerGone();
	await dispatchClick(OrganizationTeamsPage.addTeamButtonCss);
	const mutation = page.locator('ga-teams-mutation');
	const opened = await mutation
		.first()
		.waitFor({ state: 'visible', timeout: 8000 })
		.then(() => true)
		.catch(() => false);
	if (!opened) {
		await dispatchClick(OrganizationTeamsPage.addTeamButtonCss);
	}
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.teamNameInputCss);
};

export const enterNameInputData = async (data: string) => {
	await clearField(OrganizationTeamsPage.teamNameInputCss);
	await enterInput(OrganizationTeamsPage.teamNameInputCss, data);
};

export const tagsMultiSelectVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.tagsSelectCss);
};

export const clickTagsMultiSelect = async () => {
	// Tags is an ng-select (#addTags) — it opens on MOUSEDOWN and a force-click can land on the dialog
	// backdrop or even close the add form. Open it via keyboard instead (focus its inner input + ArrowDown).
	const input = getPage().locator(OrganizationTeamsPage.tagsSelectCss).locator('input').first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const selectTagsFromDropdown = async (index: number) => {
	await clickButtonByIndex(OrganizationTeamsPage.tagsSelectOptionCss, index);
};

export const employeeDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.employeeMultiSelectCss);
};

export const clickEmployeeDropdown = async (_index: number) => {
	// Members selector is a single nb-select (matched by its placeholder text), so the index is ignored —
	// open the one match. Settle any transient form spinner first; nb-select opens on click.
	await waitForSpinnerGone();
	await clickButton(OrganizationTeamsPage.employeeMultiSelectCss);
};

export const selectEmployeeFromDropdown = async (index: number) => {
	await pickEmployeeOption(index);
};

export const managerDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.managerMultiSelectCss);
};

export const clickManagerDropdown = async (_index: number) => {
	// Managers selector is a single nb-select (matched by its placeholder text), so the index is ignored.
	await waitForSpinnerGone();
	await clickButton(OrganizationTeamsPage.managerMultiSelectCss);
};

export const selectManagerFromDropdown = async (index: number) => {
	await pickEmployeeOption(index);
};

// Best-effort pick of an nb-select option (members/managers share '.option-list nb-option'). The working
// employees list loads async and can legitimately be EMPTY (no employee "working" in the selected date
// range — EmployeeSelectComponent.getWorkingEmployees). Select one if it shows; otherwise press Escape and
// continue so we don't hang on a 60s click timeout against an empty list. Mirrors
// ContactsLeads.selectEmployeeDropdownOption.
const pickEmployeeOption = async (index: number) => {
	const page = getPage();
	const option = page.locator(OrganizationTeamsPage.selectDropdownOptionCss);
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
	} catch {
		await page.keyboard.press('Escape').catch(() => {});
	}
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const clickCardBody = async (_index: number) => {
	// Dismiss an open ng-select / nb-select panel by clicking a neutral element INSIDE the dialog (the
	// form title). The old 'nb-card-body' target no longer exists in the flat ga-teams-mutation form and
	// the page card behind sits under a backdrop; Escape would close the whole nb-dialog.
	await getPage().locator(OrganizationTeamsPage.cardBodyCss).first().click({ force: true }).catch(() => undefined);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	// Save sits in the dialog; a fading backdrop from a closed sub-dropdown can intercept a coordinate
	// click, so dispatch the click straight to the element.
	await waitForSpinnerGone();
	await dispatchClick(OrganizationTeamsPage.saveButtonCss);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.selectTableRowCss);
};

export const selectTableRow = async (_index: number) => {
	// Row click TOGGLES selection (selectTeam flips disableButton). Settle the grid first, then click the
	// row once and poll the toolbar Edit button's real disabled attr; only re-click if selection was lost.
	const page = getPage();
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => undefined);
	await page.waitForTimeout(1500);

	const row = page.locator(OrganizationTeamsPage.selectTableRowCss).first();
	const editBtn = page.locator(OrganizationTeamsPage.editButtonCss).first();

	await row.click({ force: true });
	for (let i = 0; i < 5; i++) {
		const disabled = await editBtn.getAttribute('disabled');
		if (disabled === null) {
			return; // selection took — toolbar actions enabled
		}
		await page.waitForTimeout(500);
		const stillDisabled = await editBtn.getAttribute('disabled');
		if (stillDisabled !== null) {
			await row.click({ force: true }); // selection lost/never applied — click once more
		}
	}
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.editButtonCss);
};

export const clickEditButton = async () => {
	await clickButton(OrganizationTeamsPage.editButtonCss);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.deleteButtonCss);
};

export const clickDeleteButton = async () => {
	await clickButton(OrganizationTeamsPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	// Confirm sits in a freshly opened nb-dialog over a backdrop — dispatch the click to the element.
	await dispatchClick(OrganizationTeamsPage.confirmDeleteButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(OrganizationTeamsPage.toastrMessageCss);
};

export const verifyTeamExists = async (text: string) => {
	await verifyText(OrganizationTeamsPage.verifyTeamCss, text);
};

export const verifyTeamIsDeleted = async (text: string) => {
	await verifyTextNotExisting(OrganizationTeamsPage.verifyTeamCss, text);
};
