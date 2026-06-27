import dayjs from 'dayjs';
import {
	verifyElementIsVisible,
	clickButton,
	clickButtonByIndex,
	clearField,
	enterInput,
	clickElementByText,
	clickKeyboardBtnByKeycode,
	waitElementToHide,
	verifyText,
	verifyTextNotExisting,
	forceClickElementByText,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { PaymentsPage } from '../../../src/support/Base/pageobjects/PaymentsPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addPaymentButtonVisible = async () => {
	await verifyElementIsVisible(PaymentsPage.addPaymentButtonCss);
};

export const clickAddPaymentButton = async () => {
	await clickButton(PaymentsPage.addPaymentButtonCss);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(PaymentsPage.addTagsDropdownCss);
};

export const clickTagsDropdown = async (index: number) => {
	// ga-tags-color-input is an <ng-select id="addTags"> (opens on mousedown, options appendTo body).
	// A force-click lands on the dialog's cdk-overlay backdrop and DISMISSES the whole payment form
	// (the original failure: the form vanished and clickCardBody timed out). Open it via the keyboard
	// instead — focus the inner <input> (focusing the host leaves the input unfocused so ArrowDown
	// goes to <body> and never opens the panel), then ArrowDown.
	await waitForSpinnerGone();
	await getPage().locator(`${PaymentsPage.addTagsDropdownCss} input`).first().focus().catch(() => {});
	await getPage().keyboard.press('ArrowDown').catch(() => {});
};

export const selectTagFromDropdown = async (index: number) => {
	const page = getPage();
	const option = page.locator(PaymentsPage.tagsDropdownOption);
	// Re-open the tags ng-select via keyboard until the options (div.ng-option, appended to body)
	// render, then pick one. ng-select opens on mousedown so a click is backdrop-blocked.
	for (let i = 0; i < 4; i++) {
		if (await option.first().isVisible().catch(() => false)) break;
		await waitForSpinnerGone();
		await page.locator(`${PaymentsPage.addTagsDropdownCss} input`).first().focus().catch(() => {});
		await page.keyboard.press('ArrowDown').catch(() => {});
		await page.waitForTimeout(800);
	}
	await clickButtonByIndex(PaymentsPage.tagsDropdownOption, index);
};

export const projectDropdownVisible = async () => {
	await verifyElementIsVisible(PaymentsPage.projectDropdownCss);
};

export const clickProjectDropdown = async () => {
	// ga-project-selector (single-select) is an <ng-select formcontrolname="projectId"> (opens on
	// mousedown, options appendTo body). Same backdrop hazard as the tags input — open via keyboard,
	// focusing the inner <input> so ArrowDown actually opens the panel.
	await waitForSpinnerGone();
	await getPage().locator(`${PaymentsPage.projectDropdownCss} input`).first().focus().catch(() => {});
	await getPage().keyboard.press('ArrowDown').catch(() => {});
};

export const selectProjectFromDropdown = async (text: string) => {
	const page = getPage();
	const input = page.locator(`${PaymentsPage.projectDropdownCss} input`).first();
	// Typeahead-filter the ng-select to the wanted project, then click the matching option from the
	// body-appended panel (div.ng-option).
	await input.focus().catch(() => {});
	await input.fill('').catch(() => {});
	await input.pressSequentially(String(text), { delay: 30 }).catch(() => {});
	await page.waitForTimeout(400);
	// Pick the real project option, NOT the ng-select [addTag] "Add <text>" option (the form already
	// created this project, so the existing option is present).
	const option = page
		.locator(PaymentsPage.projectDropdownOptionCss)
		.filter({ hasText: String(text) })
		.filter({ hasNotText: 'Add' });
	await option.first().click({ force: true });
	await page.waitForTimeout(400);
};

export const dateInputVisible = async () => {
	await verifyElementIsVisible(PaymentsPage.dateInputCss);
};

export const enterDateInputData = async () => {
	await clearField(PaymentsPage.dateInputCss);
	const date = dayjs().format('MMM D, YYYY');
	await enterInput(PaymentsPage.dateInputCss, date);
};

export const paymentMethodDropdownVisible = async () => {
	await verifyElementIsVisible(PaymentsPage.paymentMethodDropdownCss);
};

export const clickPaymentMethodDropdown = async () => {
	await clickButton(PaymentsPage.paymentMethodDropdownCss);
};

export const selectPaymentMethod = async (text: string) => {
	await clickElementByText(PaymentsPage.paymentMethodDropdownOptionCss, text);
};

export const amountInputVisible = async () => {
	await verifyElementIsVisible(PaymentsPage.amountInputCss);
};

export const enterAmountInputData = async (data: string) => {
	await clearField(PaymentsPage.amountInputCss);
	await enterInput(PaymentsPage.amountInputCss, data);
};

export const noteTextareaVisible = async () => {
	await verifyElementIsVisible(PaymentsPage.noteInputCss);
};

export const enterNoteInputData = async (data: string) => {
	await clearField(PaymentsPage.noteInputCss);
	await enterInput(PaymentsPage.noteInputCss, data);
};

export const savePaymentButtonVisible = async () => {
	await verifyElementIsVisible(PaymentsPage.saveExpenseButtonCss);
};

export const clickSavePaymentButton = async () => {
	// The Save button is [disabled]="form.invalid"; wait until it's enabled (a force/dispatch click on a
	// disabled button is a no-op) then dispatch the click — a fading dialog backdrop intercepts a
	// coordinate click. Finally wait for the mutation dialog to detach, confirming the submit landed.
	const page = getPage();
	const saveBtn = page.locator(PaymentsPage.saveExpenseButtonCss).first();
	await saveBtn.waitFor({ state: 'visible', timeout: 15000 });
	for (let i = 0; i < 10; i++) {
		if (await saveBtn.isEnabled().catch(() => false)) break;
		await page.waitForTimeout(500);
	}
	await waitForSpinnerGone();
	await dispatchClick(PaymentsPage.saveExpenseButtonCss);
	await page
		.locator('ga-payment-add')
		.first()
		.waitFor({ state: 'detached', timeout: 15000 })
		.catch(() => undefined);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(PaymentsPage.selectTableRowCss);
};

export const selectTableRow = async (index: number) => {
	// Selecting a grid row toggles selection and enables the toolbar Edit/Delete buttons. Settle the
	// grid first (a re-render mid-click can swallow the selection), click the data row ONCE, then poll
	// the Edit button's real `disabled` attribute — only re-click if selection was lost. Never rapid
	// re-click (that would toggle the row back off).
	const page = getPage();
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const row = page.locator(PaymentsPage.selectTableRowCss).nth(index);
	const editBtn = page.locator(PaymentsPage.editPaymentButtonCss).first();
	await row.click({ force: true });
	for (let i = 0; i < 6; i++) {
		const disabled = await editBtn.getAttribute('disabled').catch(() => null);
		if (disabled === null) return; // enabled -> row is selected
		await page.waitForTimeout(700);
		if (i === 2) await row.click({ force: true }); // single retry mid-way if selection didn't take
	}
};

export const editPaymentButtonVisible = async () => {
	await verifyElementIsVisible(PaymentsPage.editPaymentButtonCss);
};

export const clickEditPaymentButton = async () => {
	// Clicked right after row selection; a coordinate click can land on the still-fading selection
	// overlay. dispatchClick fires the (click) handler directly to open the edit dialog.
	await dispatchClick(PaymentsPage.editPaymentButtonCss);
};

export const deletePaymentButtonVisible = async () => {
	await verifyElementIsVisible(PaymentsPage.deletePaymentButtonCss);
};

export const clickDeletePaymentButton = async () => {
	// Clicked right after row selection — dispatch the click to open the delete-confirmation dialog
	// reliably (a coordinate click can be intercepted by the fading selection overlay).
	await dispatchClick(PaymentsPage.deletePaymentButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(PaymentsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	// The confirm (OK) button lives in a freshly-opened nb-dialog; dispatch the click so the fading
	// backdrop of the just-closed selection/previous dialog can't intercept it.
	await dispatchClick(PaymentsPage.confirmDeleteButtonCss);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const clickCardBody = async () => {
	// Click the dialog footer to blur/close the still-open tags ng-select (closeOnSelect=false) before
	// moving to the next field — same proven pattern as Estimates' clickCardBody.
	await clickButton(PaymentsPage.cardBodyCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(PaymentsPage.toastrMessageCss);
};

export const verifyElementIsDeleted = async (text: string) => {
	await verifyTextNotExisting(PaymentsPage.verifyPaymentCss, text);
};

export const verifyPaymentExists = async (text: string) => {
	await verifyText(PaymentsPage.verifyPaymentCss, text);
};

export const sidebarBtnVisible = async () => {
	await verifyElementIsVisible(PaymentsPage.sidebarBtnCss);
};

export const clickSidebarBtn = async (text: string) => {
	await clickElementByText(PaymentsPage.sidebarBtnCss, text);
};

export const clickAccountingPaymentsSidebarBtn = async (text: string) => {
	await forceClickElementByText(PaymentsPage.accountingPaymentsSidebarBtnCss, text);
};

export const clickReportsInnerSidebarBtn = async (text: string) => {
	await forceClickElementByText(PaymentsPage.reportsPaymentsSidebarBtnCss, text);
};

export const verifyPaymentProject = async (project: string) => {
	await verifyText(PaymentsPage.paymentTableCellCss, project);
};

export const verifyPaymentAmount = async (amount: string) => {
	await verifyText(PaymentsPage.amountTableCellCss, amount);
};

export const groupBySelectVisible = async () => {
	await verifyElementIsVisible(PaymentsPage.groupByCss);
};

export const clickGroupBySelect = async () => {
	await clickButton(PaymentsPage.groupByCss);
};

export const verifyDropdownOption = async (text: string) => {
	await verifyText(PaymentsPage.dropdownOptionCss, text);
};

export const selectOptionFromDropdown = async (text: string) => {
	await clickElementByText(PaymentsPage.dropdownOptionCss, text);
};

export const selectTableRowByNote = async (text: string) => {
	await clickElementByText(PaymentsPage.selectTableRowCss, text);
};
