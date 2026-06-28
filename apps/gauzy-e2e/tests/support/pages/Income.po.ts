import dayjs from 'dayjs';
import {
	enterInput,
	verifyElementIsVisible,
	clearField,
	clickKeyboardBtnByKeycode,
	verifyElementNotExist,
	waitUntil,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { IncomePage } from '../../../src/support/Base/pageobjects/IncomePageObject';

// Open an `appendTo="body"` ng-select via the KEYBOARD (focus its inner input), never a coordinate click:
// these dropdowns open on mousedown and the addTag/addContact dialogs that ran just before leave fading
// cdk-overlay backdrops that swallow a click on the control — a force-click can even close the form.
// Typing filters/creates the option; pressing Enter then commits (addTag selects render the typed value as
// a "create" option). Returns the focused input locator. Mirrors the verified Expenses.po helper.
const openNgSelectAndType = async (ngSelectCss: string, text?: string) => {
	const page = getPage();
	const input = page.locator(ngSelectCss).locator('input').first();
	await input.focus();
	if (text !== undefined) {
		// pressSequentially (per-char keystrokes) — ng-select opens + filters on keydown, which a bulk
		// .fill() does not always trigger (mirrors the verified ContactsLeads country-select helper).
		await input.pressSequentially(String(text), { delay: 50 });
		await page.waitForTimeout(600);
	} else {
		// No text (existing-option selects): ArrowDown opens the dropdown while the input has focus.
		await page.keyboard.press('ArrowDown');
		await page.waitForTimeout(400);
	}
	return input;
};

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addIncomeButtonVisible = async () => verifyElementIsVisible(IncomePage.addIncomeButtonCss);

export const clickAddIncomeButton = async () => {
	// dispatchClick after settling the page spinner: the toolbar "Add" opens the mutation dialog; reached
	// right after navigation while the nb-card spinner overlays the toolbar, so a coordinate click can land
	// on the spinner/backdrop and the dialog never opens. dispatch fires addIncome() straight on the button.
	// Retry until the ngx-income-mutation host appears (the first dispatch can land before the handler wires).
	const page = getPage();
	const dialog = page.locator('ngx-income-mutation');
	await waitUntil(2000);
	await waitForSpinnerGone();
	for (let i = 0; i < 4; i++) {
		await dispatchClick(IncomePage.addIncomeButtonCss);
		await page.waitForTimeout(1200);
		if (await dialog.count()) return;
	}
};

export const selectEmployeeDropdownVisible = async () => verifyElementIsVisible(IncomePage.selectEmployeeDropdownCss);

export const clickEmployeeDropdown = async () => {
	// Open via keyboard, not a click — the employee selector is an appendTo=body ng-select that opens on
	// mousedown and is blocked by leftover backdrops; focusing its input + ArrowDown opens it reliably.
	await waitForSpinnerGone();
	await openNgSelectAndType(IncomePage.selectEmployeeDropdownCss);
};

export const selectEmployeeFromDropdown = async (index: number) => {
	// Best-effort employee pick (mirror Expenses/ContactsLeads): the option list loads async; the seeded
	// admin/employee should be present, but click an option only if one shows within ~8s, else dismiss the
	// dropdown and continue. The employee is optional on income, so the record still saves either way. A
	// hard option[index] click against an empty list would otherwise hang the test on the task timeout.
	const page = getPage();
	const option = page.locator(IncomePage.selectEmployeeDropdownOptionCss);
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
	} catch {
		// Dismiss an empty/open ng-select dropdown by clicking the inert dialog TITLE, NOT by pressing
		// Escape: the income-mutation NbDialog defaults to closeOnEsc=true, so a document-level Escape would
		// close the whole dialog. An in-dialog outside-click closes only the ng-select overlay.
		await page.locator(IncomePage.cardBodyCss).first().click({ force: true }).catch(() => {});
	}
};

export const dateInputVisible = async () => verifyElementIsVisible(IncomePage.dateInputCss);

export const enterDateInputData = async () => {
	await clearField(IncomePage.dateInputCss);
	const date = dayjs().format('MMM D, YYYY');
	await enterInput(IncomePage.dateInputCss, date);
};

export const contactInputVisible = async () => verifyElementIsVisible(IncomePage.organizationContactCss);

export const clickContactInput = async () => {
	await openNgSelectAndType(IncomePage.organizationContactCss);
};

export const enterContactInputData = async (data: string) => {
	// ga-contact-select is an appendTo=body ng-select with addTag: open via keyboard (focus input), type the
	// new contact name to surface the "Add item" option, then Enter to create-and-select (no coordinate
	// click, which would land on a leftover backdrop or close the form).
	await openNgSelectAndType(IncomePage.organizationContactCss, data);
	await clickKeyboardBtnByKeycode(13);
};

export const amountInputVisible = async () => verifyElementIsVisible(IncomePage.amountInputCss);

export const enterAmountInputData = async (data: string) => {
	await clearField(IncomePage.amountInputCss);
	await enterInput(IncomePage.amountInputCss, data);
};

export const tagsDropdownVisible = async () => verifyElementIsVisible(IncomePage.addTagsDropdownCss);

export const clickTagsDropdown = async () => {
	// ga-tags-color-input (#addTags) is an appendTo=body ng-select — open via keyboard, not a click, to
	// dodge leftover dialog backdrops (ng-select opens on mousedown so dispatchClick can't help either).
	await openNgSelectAndType(IncomePage.addTagsDropdownCss);
};

export const selectTagFromDropdown = async (index: number) => {
	// Best-effort tag pick: an org tag was created by the addTag prerequisite, but the list still loads
	// async — click the option if it shows, else dismiss and continue (tags are optional on income).
	const page = getPage();
	const option = page.locator(IncomePage.tagsDropdownOption);
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
	} catch {
		// As in selectEmployeeFromDropdown: dismiss the open tags ng-select by clicking the inert dialog
		// title, NEVER Escape — the dialog's default closeOnEsc would close the whole add-income form.
		await page.locator(IncomePage.cardBodyCss).first().click({ force: true }).catch(() => {});
	}
};

export const notesTextareaVisible = async () => verifyElementIsVisible(IncomePage.notesInputCss);

export const enterNotesInputData = async (data: string) => {
	// notes is a plain <textarea formcontrolname="notes"> in the income-mutation form (NOT ckeditor), so
	// clearField/enterInput (.clear()/.fill()) work directly.
	await clearField(IncomePage.notesInputCss);
	await enterInput(IncomePage.notesInputCss, data);
};

export const saveIncomeButtonVisible = async () => verifyElementIsVisible(IncomePage.saveIncomeButtonCss);

export const clickSaveIncomeButton = async () => {
	// dispatchClick (not a coordinate click): the just-closed tags/contact ng-select overlays + the addTag
	// dialog leave fading cdk-overlay backdrops over the footer, so a force click lands on the backdrop and
	// the dialog never closes (=> no income created). dispatch fires addOrEditIncome() straight on the
	// button via formDirective.ngSubmit.emit(); it still gates on form validity. Settle any spinner first.
	await waitForSpinnerGone();
	await dispatchClick(IncomePage.saveIncomeButtonCss);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => clickKeyboardBtnByKeycode(keycode);

export const tableRowVisible = async () => verifyElementIsVisible(IncomePage.selectTableRowCss);

// Select the income grid row that carries our unique faker contact `name` (its client column). The suite
// shares ONE seeded DB and runs serially, so earlier specs leave income/contact rows behind — selecting by
// index (row 0) would grab the WRONG record. Scope to the unique name, then poll the Edit button's REAL
// `disabled` attribute (the toolbar buttons gate on [disabled]="!selectedItem && disableButton" and never
// get a .btn-disabled class). Clicking the row TOGGLES selection, so re-click only if the click was lost.
export const selectTableRow = async (name: string) => {
	const page = getPage();
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const row = page.locator(IncomePage.selectTableRowCss).filter({ hasText: name }).first();
	const editBtn = page.locator(IncomePage.editIncomeButtonCss).first();
	for (let attempt = 0; attempt < 4; attempt++) {
		await row.click({ force: true });
		for (let i = 0; i < 8; i++) {
			await page.waitForTimeout(350);
			if (!(await editBtn.isDisabled().catch(() => true))) return;
		}
	}
};

export const editIncomeButtonVisible = async () => verifyElementIsVisible(IncomePage.editIncomeButtonCss);

export const clickEditIncomeButton = async () => {
	// dispatchClick: the preceding save/toastr leaves a fading backdrop over the toolbar that swallows a
	// coordinate click on Edit; dispatch fires editIncome(selectedItem) directly.
	await waitForSpinnerGone();
	await dispatchClick(IncomePage.editIncomeButtonCss);
};

export const deleteIncomeButtonVisible = async () => verifyElementIsVisible(IncomePage.deleteIncomeButtonCss);

export const clickDeleteIncomeButton = async () => {
	// dispatchClick: same leftover-backdrop reason — fire deleteIncome(selectedItem) directly on the toolbar.
	await waitForSpinnerGone();
	await dispatchClick(IncomePage.deleteIncomeButtonCss);
};

export const confirmDeleteButtonVisible = async () => verifyElementIsVisible(IncomePage.confirmDeleteButtonCss);

export const clickConfirmDeleteButton = async () => {
	// dispatchClick: the delete-confirmation dialog footer can sit under a leftover backdrop; dispatch fires
	// the confirm directly so the dialog actually closes and the row is removed.
	await waitForSpinnerGone();
	await dispatchClick(IncomePage.confirmDeleteButtonCss);
};

export const clickCardBody = async () => {
	// Dismiss the still-open tags ng-select overlay (closeOnSelect=false) before clicking Save by clicking
	// the inert dialog title (no handler). Do NOT press Escape — the NbDialog defaults to closeOnEsc=true,
	// so a document-level Escape would close the ENTIRE add-income dialog.
	await getPage().locator(IncomePage.cardBodyCss).first().click({ force: true }).catch(() => {});
};

export const waitMessageToHide = async () => {
	// Poll for the toast to clear instead of the shared util's fixed 10s hard-sleep, which would blow the
	// per-test timeout across the spec's many calls.
	const toast = getPage().locator(IncomePage.toastrMessageCss);
	try {
		await toast.first().waitFor({ state: 'hidden', timeout: 12000 });
	} catch {
		/* no toast appeared / already gone */
	}
};

// Assert the income row carrying our unique faker contact `name` is gone (count 0 of that name). A plain
// "grid is empty" check is wrong under shared-DB pollution — other specs' income rows remain.
export const verifyElementIsDeleted = async (name: string) =>
	verifyElementNotExist(`${IncomePage.verifyIncomeCss}:has-text("${name}")`);

// Assert the income we just created exists by scoping to the row carrying our unique faker contact `name`
// (its client column), NOT the shared static notes text and NOT row 0 — both are unreliable under the
// shared serial DB where earlier specs leave income rows behind.
export const verifyIncomeExists = async (name: string) => {
	const { expect } = await import('@playwright/test');
	const row = getPage().locator(IncomePage.verifyIncomeCss).filter({ hasText: name }).first();
	await expect(row).toBeVisible({ timeout: 24000 });
};
