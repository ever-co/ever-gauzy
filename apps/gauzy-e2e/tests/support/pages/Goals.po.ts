import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickButtonByIndex,
	waitElementToHide,
	clickElementByText,
	verifyText,
	verifyElementNotExist,
	waitUntil,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { GoalsPage } from '../../../src/support/Base/pageobjects/GoalsPageObject';

export const addButtonVisible = async () => {
	await verifyElementIsVisible(GoalsPage.addButtonCss);
};

export const clickAddButton = async (index) => {
	// The Goals page shows a full-card nb-spinner over the toolbar right after navigation and leaves a
	// fading cdk-overlay backdrop after each mutation; a coordinate {force:true} click lands on that
	// overlay instead of the button, so "Add new Objective" (index 0) never toggled its nbPopover and
	// the create-menu list never rendered. Wait the spinner out, then dispatch the click straight to the
	// element so the (click) handler fires regardless of any overlay on top.
	await waitForSpinnerGone();
	// index 0 = toolbar "Add new Objective" (opens the nbPopover); index 1 = "Add new Key Result" inside
	// the expanded accordion body (a different element, not an nth() of the toolbar add button).
	const selector = index === 0 ? GoalsPage.addButtonCss : GoalsPage.addKeyResultButtonCss;
	const button = getPage().locator(selector).first();
	await button.waitFor({ state: 'attached', timeout: 24000 }).catch(() => {});
	await button.dispatchEvent('click');
};

export const selectOptionFromDropdown = async (index) => {
	// The "Add new Objective" nb-popover renders as a CDK overlay on click; wait for its option to
	// paint, then dispatch the click straight to the list item — a coordinate click can land on the
	// popover backdrop rather than the "Create new" item.
	await verifyElementIsVisible(GoalsPage.optionDropdownCss);
	await getPage().locator(GoalsPage.optionDropdownCss).nth(index).dispatchEvent('click');
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(GoalsPage.nameInputCss);
};

export const enterNameInputData = async (data) => {
	await clearField(GoalsPage.nameInputCss);
	await enterInput(GoalsPage.nameInputCss, data);
};

export const ownerDropdownVisible = async () => {
	await verifyElementIsVisible(GoalsPage.ownerDropdownCss);
};

export const clickOwnerDropdown = async () => {
	await clickButton(GoalsPage.ownerDropdownCss);
};

export const selectOwnerFromDropdown = async (index) => {
	// The objective form defaults to ORGANIZATION level, so the owner nb-select holds a single option
	// (the org). The spec passes the org NAME here but the underlying control is index-based; always
	// pick option 0 (the only one) so a stray non-numeric arg can't break the nth() lookup. Wait for the
	// nb-select overlay option to render first.
	const option = getPage().locator(GoalsPage.dropdownOptionCss);
	await option.first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
	await option.first().click({ force: true });
};

export const leadDropdownVisible = async () => {
	await verifyElementIsVisible(GoalsPage.leadDropdownCss);
};

export const clickLeadDropdown = async () => {
	await clickButton(GoalsPage.leadDropdownCss);
};

export const selectLeadFromDropdown = async (index) => {
	// Best-effort: the objective "Lead" is an employee multi-select whose options are the employees
	// "working" in the header date range (loaded async) and is frequently EMPTY on the test DB. Lead is
	// optional (leadId has no validator), so pick one if it renders, otherwise Escape and continue —
	// avoids a 60s hang on an empty list. Mirrors ContactsLeads.selectEmployeeDropdownOption.
	const page = getPage();
	const option = page.locator(GoalsPage.dropdownOptionCss);
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
	} catch {
		await page.keyboard.press('Escape').catch(() => {});
	}
};

export const confirmButtonVisible = async () => {
	await verifyElementIsVisible(GoalsPage.confirmButtonCss);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(GoalsPage.editButtonCss);
};

export const clickEditButton = async (index) => {
	await clickButtonByIndex(GoalsPage.editButtonCss, index);
};

export const viewButtonVisible = async () => {
	await verifyElementIsVisible(GoalsPage.viewButtonCss);
};

export const clickViewButton = async (index) => {
	await clickButtonByIndex(GoalsPage.viewButtonCss, index);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(GoalsPage.deleteButtonCss);
};

export const clickDeleteButton = async () => {
	await clickButton(GoalsPage.deleteButtonCss);
};

export const clickConfirmButton = async () => {
	// Save/confirm on a dialog footer: wait the card spinner out, then dispatch the click so a fading
	// cdk-overlay backdrop from the just-opened dialog can't swallow a coordinate click.
	await waitForSpinnerGone();
	await dispatchClick(GoalsPage.confirmButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(GoalsPage.toastrMessageCss);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(GoalsPage.tableRowCss);
};

export const clickTableRow = async (index) => {
	// Settle after the preceding mutation/toastr (a fading cdk-overlay backdrop can swallow a coordinate
	// click on the accordion header), then dispatch the click straight to the row so onClickObjective +
	// the accordion expand reliably fire. The header click both selects the objective (enables the
	// toolbar View/Edit/Delete) and expands the body (reveals "Add new Key Result").
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => {});
	await waitUntil(1500);
	// Dispatch on the accordion-item-HEADER, not the item: both onClickObjective and Nebular's expand
	// toggle are host (click) listeners on the header element, and a click dispatched on the parent item
	// doesn't reach them. (verifyGoalCss is that header selector.)
	const row = getPage().locator(GoalsPage.verifyGoalCss).nth(index);
	await row.waitFor({ state: 'attached', timeout: 24000 }).catch(() => {});
	await row.dispatchEvent('click');
};

export const keyResultInputVisible = async () => {
	await verifyElementIsVisible(GoalsPage.keyResultInputCss);
};

export const enterKeyResultNameData = async (data) => {
	await clearField(GoalsPage.keyResultInputCss);
	await enterInput(GoalsPage.keyResultInputCss, data);
};

export const initialValueInputVisible = async () => {
	await verifyElementIsVisible(GoalsPage.initialValueCss);
};

export const enterInitialValueData = async (data) => {
	await clearField(GoalsPage.initialValueCss);
	await enterInput(GoalsPage.initialValueCss, data);
};

export const targetValueInputVisible = async () => {
	await verifyElementIsVisible(GoalsPage.targetValueCss);
};

export const enterTargetValueData = async (data) => {
	await clearField(GoalsPage.targetValueCss);
	await enterInput(GoalsPage.targetValueCss, data);
};

export const keyResultOwnerDropdownVisible = async () => {
	await verifyElementIsVisible(GoalsPage.keyResultOwnerCss);
};

export const clickKeyResultOwnerDropdown = async () => {
	await clickButton(GoalsPage.keyResultOwnerCss);
};

export const selectKeyResultOwnerFromDropdown = async (index) => {
	// Best-effort employee pick (same async/empty-list hazard as the objective lead). The key-result
	// owner IS required to save, but the option list loads async — wait up to ~8s, pick one if present,
	// else Escape so we never hard-hang 60s on an empty list.
	const page = getPage();
	const option = page.locator(GoalsPage.dropdownOptionCss);
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
	} catch {
		await page.keyboard.press('Escape').catch(() => {});
	}
};

export const keyResultLeadDropdownVisible = async () => {
	await verifyElementIsVisible(GoalsPage.keyResultLeadCss);
};

export const clickKeyResultLeadDropdown = async () => {
	await clickButton(GoalsPage.keyResultLeadCss);
};

export const selectKeyResultLeadFromDropdown = async (index) => {
	// Best-effort employee pick (lead is optional; same async/empty-list hazard).
	const page = getPage();
	const option = page.locator(GoalsPage.dropdownOptionCss);
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
	} catch {
		await page.keyboard.press('Escape').catch(() => {});
	}
};

export const toggleButtonVisible = async () => {
	await verifyElementIsVisible(GoalsPage.toggleButtonCss);
};

export const clickToggleButton = async () => {
	await clickButton(GoalsPage.toggleButtonCss);
};

export const addNewDeadlineButtonVisible = async () => {
	await verifyElementIsVisible(GoalsPage.addDeadlineButtonCss);
};

export const clickAddDeadlineButton = async () => {
	await clickButton(GoalsPage.addDeadlineButtonCss);
};

export const updatedValueInputVisible = async () => {
	await verifyElementIsVisible(GoalsPage.updatedValueCss);
};

export const enterUpdatedValueData = async (data) => {
	await clearField(GoalsPage.updatedValueCss);
	await enterInput(GoalsPage.updatedValueCss, data);
};

export const saveDeadlineButtonVisible = async () => {
	await verifyElementIsVisible(GoalsPage.saveDeadlineButtonCss);
};

export const clickSaveDeadlineButton = async () => {
	await clickButton(GoalsPage.saveDeadlineButtonCss);
};

export const weightTypeButtonVisible = async () => {
	await verifyElementIsVisible(GoalsPage.weightTypeButtonCss);
};

export const clickWeightTypeButton = async (index) => {
	await clickButtonByIndex(GoalsPage.weightTypeButtonCss, index);
};

export const weightParameterDropdownVisible = async () => {
	await verifyElementIsVisible(GoalsPage.weightParameterDropdownCss);
};

export const clickWeightParameterDropdown = async () => {
	await clickButton(GoalsPage.weightParameterDropdownCss);
};

export const selectWeightParameterFromDropdown = async (text) => {
	await clickElementByText(GoalsPage.dropdownOptionCss, text);
};

export const progressBarVisible = async () => {
	await verifyElementIsVisible(GoalsPage.progressBarCss);
};

export const clickProgressBar = async (index) => {
	await clickButtonByIndex(GoalsPage.progressBarCss, index);
};

export const verifyElementIsDeleted = async () => {
	await verifyElementNotExist(GoalsPage.verifyGoalCss);
};

export const verifyGoalExists = async (text) => {
	await verifyText(GoalsPage.verifyGoalCss, text);
};
