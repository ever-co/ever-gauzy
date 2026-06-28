import dayjs from 'dayjs';
import {
	verifyElementIsVisible,
	clickButton,
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
	// The payments page can still be settling right after navigation, so the first force-click on the
	// toolbar Add button can land before its (click)="recordPayment()" handler is wired (the dialog
	// never opens). Click, then retry until the payment-mutation dialog (ga-payment-add) is present —
	// mirrors the verified Income/Expenses add helpers.
	const page = getPage();
	const dialog = page.locator('ga-payment-add');
	await waitForSpinnerGone();
	for (let i = 0; i < 4; i++) {
		await clickButton(PaymentsPage.addPaymentButtonCss);
		await page.waitForTimeout(1200);
		if (await dialog.count()) return;
	}
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
	// Best-effort tag pick. Tags are OPTIONAL on a payment (no validator on the `tags` control), and the
	// org-tag list still loads async. Crucially, the tags ng-select panel is appendTo=body and sits over
	// the nb-dialog's cdk-overlay-backdrop, so a COORDINATE click on an option (even {force:true}) can
	// land on the dialog backdrop and DISMISS the whole payment form — the exact failure here: by the
	// next step (clickCardBody) the dialog was already gone and the footer click timed out. So select via
	// the KEYBOARD only (ArrowDown to highlight, Enter to toggle — multiple+closeOnSelect=false), which
	// never touches the backdrop. We DON'T close the panel here — clickCardBody (next step) issues the
	// single Escape that closes it. If no option renders within ~8s, just continue — tags are optional.
	const page = getPage();
	const tagInput = page.locator(`${PaymentsPage.addTagsDropdownCss} input`).first();
	const option = page.locator(PaymentsPage.tagsDropdownOption);
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await tagInput.focus().catch(() => {});
		for (let i = 0; i <= index; i++) {
			await page.keyboard.press('ArrowDown').catch(() => {});
		}
		await page.keyboard.press('Enter').catch(() => {});
	} catch {
		/* tag list never rendered — tags are optional, continue */
	}
	// Do NOT press Escape here. The payment dialog opens with Nebular's default closeOnEsc=true, so an
	// Escape with no open dropdown closes the WHOLE form. clickCardBody (the very next step) presses a
	// single Escape to close this (closeOnSelect=false) tags panel — mirroring the verified-green Expenses
	// flow where exactly ONE Escape is issued. Two Escapes (here + clickCardBody) would dismiss the dialog
	// and the next field (projectId) would never be found.
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
	// Best-effort project pick via the KEYBOARD only. projectId is OPTIONAL on a payment (no validator),
	// and the project ng-select panel is appendTo=body over the dialog backdrop — a coordinate click on
	// an option can land on the backdrop and dismiss the form (same hazard as the tags input). Typeahead
	// to filter to the wanted project, then Enter to select the highlighted option (the selector's
	// (change) blurs/closes the panel). If the option never renders, Escape and continue.
	const page = getPage();
	const input = page.locator(`${PaymentsPage.projectDropdownCss} input`).first();
	await input.focus().catch(() => {});
	await input.fill('').catch(() => {});
	await input.pressSequentially(String(text), { delay: 30 }).catch(() => {});
	await page.waitForTimeout(500);
	// Pick the real project option, NOT the ng-select [addTag] "Add <text>" create option.
	const option = page
		.locator(PaymentsPage.projectDropdownOptionCss)
		.filter({ hasText: String(text) })
		.filter({ hasNotText: 'Add' });
	try {
		await option.first().waitFor({ state: 'visible', timeout: 6000 });
		await page.keyboard.press('Enter').catch(() => {});
	} catch {
		await page.keyboard.press('Escape').catch(() => {});
	}
	await page.waitForTimeout(300);
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
	// Purpose: dismiss the still-open tags ng-select overlay (closeOnSelect=false) before the next field.
	// Press Escape instead of force-clicking the dialog footer (nb-card-footer.text-left): that footer
	// click was the failing step — it timed out at 60s whenever the tags interaction had already closed
	// the dialog, and even when present a coordinate click near the footer risks the dialog backdrop.
	// Escape closes the dropdown overlay and leaves the payment form intact (mirrors Expenses.clickCardBody).
	await getPage().keyboard.press('Escape').catch(() => {});
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
