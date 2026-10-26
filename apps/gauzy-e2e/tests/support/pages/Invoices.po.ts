import { expect, Locator } from '@playwright/test';
import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	clickElementByText,
	verifyValue,
	scrollDown,
	verifyElementIsNotVisible
} from '../util';
import { committedValues, realOptionSelector, selectNgOption } from '../ng-select';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { InvoicesPage } from '../../../src/support/Base/pageobjects/InvoicesPageObject';

// ────────────────────────────────────────────────────────────────────────────────────────────────
// Settle helpers. Every wait is bounded: the scenario chains ~9 CRUD operations inside the 240 s
// per-test budget, so nothing here may block on an open-ended network/spinner state.
// ────────────────────────────────────────────────────────────────────────────────────────────────

/** The list card's own `[nbSpinner]="loading"` (on nb-card-body since #10182) and the table's loading class. */
const settleGrid = async () => {
	const page = getPage();
	await page.locator(InvoicesPage.listSpinnerCss).first().waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
	await page
		.waitForFunction(() => !document.querySelector('ngx-invoices angular2-smart-table.ga-table-loading'), undefined, {
			timeout: 8000
		})
		.catch(() => {});
	await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
};

/** The add/edit form card's `[nbSpinner]="loading"`. */
const settleForm = async () => {
	await getPage().locator(InvoicesPage.formSpinnerCss).first().waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
};

/**
 * Close the toolbar "more" popover if it is open. Its `gauzyOutside` handler only closes it for a click
 * INSIDE it (outside.directive.ts emits `clickedInside`), so a row click leaves it open on top of the
 * grid's right-hand side, where a later coordinate click could land on one of its actions. Toggling the
 * More button again is what closes it (toggleActionsPopover()).
 */
const closeActionsPopover = async () => {
	const page = getPage();
	const popover = page.locator(InvoicesPage.popoverCss).first();
	if (!(await popover.isVisible().catch(() => false))) return;
	await page.locator(InvoicesPage.moreButtonCss).first().dispatchEvent('click').catch(() => {});
	await popover.waitFor({ state: 'hidden', timeout: 4000 }).catch(() => {});
};

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addButtonVisible = async () => {
	await verifyElementIsVisible(InvoicesPage.addButtonCss);
};

export const clickAddButton = async () => {
	// add() navigates to /invoices/add. Dispatch past the list spinner, then wait for the add form to
	// actually render; re-dispatch once if the click was swallowed.
	const page = getPage();
	for (let attempt = 0; attempt < 2; attempt++) {
		await settleGrid();
		await page.locator(InvoicesPage.addButtonCss).first().dispatchEvent('click').catch(() => {});
		try {
			await page.locator(`ga-invoice-add ${InvoicesPage.discountInputCss}`).first().waitFor({ state: 'visible', timeout: 15000 });
			await settleForm();
			return;
		} catch {
			/* still on the list — retry */
		}
	}
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(InvoicesPage.addTagsDropdownCss);
};

export const clickTagsDropdown = async () => {
	// focus + ArrowDown (NOT a click): ng-select opens on mousedown; keyboard opens it without hit-testing.
	// The focus MUST target the inner <input> — focusing the ng-select host leaves ArrowDown on <body>.
	await settleForm();
	await getPage().locator(`${InvoicesPage.addTagsDropdownCss} input`).first().focus().catch(() => {});
	await getPage().keyboard.press('ArrowDown').catch(() => {});
};

export const selectTagFromDropdown = async (index) => {
	// Shared ng-select driver: real options only, commit proven by div.ng-value. Best-effort (the tag is
	// optional on the form).
	await selectNgOption(InvoicesPage.addTagsDropdownCss, InvoicesPage.tagsDropdownOption, index);
};

export const clickCardBody = async () => {
	// Close the tags panel ([closeOnSelect]="false" keeps it open after a pick). It is appended to body and
	// hangs over the fields below it, where the next force-clicks (discount/tax nb-selects) would land on
	// a tag option instead. Escape in its input closes it (ng-select keydown); if it is still up, a click
	// on the inert form title closes it via ng-select's outside-mousedown handler. Never click the header
	// itself — it hosts the back-navigation button.
	const page = getPage();
	const panel = page.locator('ng-dropdown-panel').first();
	await page.locator(`${InvoicesPage.addTagsDropdownCss} input`).first().focus().catch(() => {});
	await page.keyboard.press('Escape').catch(() => {});
	if (await panel.isVisible().catch(() => false)) {
		await page.locator(InvoicesPage.cardBodyCss).first().click({ force: true, timeout: 5000 }).catch(() => {});
	}
	await panel.waitFor({ state: 'hidden', timeout: 4000 }).catch(() => {});
};

export const waitMessageToHide = async () => {
	// Bounded replacement for util.waitElementToHide's unconditional 10 s sleep (this scenario calls it
	// six times; the sleeps alone used a quarter of the 240 s budget). Settle the mutation that raised the
	// toast (spinners + network), then keep the original assertion: no toast left on screen. Toasts last
	// 5 s (ToastrService config), so the 24 s window is ample.
	const page = getPage();
	await page.waitForTimeout(1000);
	await settleForm();
	await settleGrid();
	await expect(page.locator(InvoicesPage.toastrMessageCss)).toHaveCount(0, { timeout: 24000 });
};

export const discountInputVisible = async () => {
	await verifyElementIsVisible(InvoicesPage.discountInputCss);
};

export const enterDiscountData = async (data) => {
	await clearField(InvoicesPage.discountInputCss);
	await enterInput(InvoicesPage.discountInputCss, data);
};

export const discountTypeDropdownVisible = async () => {
	await verifyElementIsVisible(InvoicesPage.discountTypeDropdownCss);
};

export const clickDiscountDropdown = async () => {
	await clickButton(InvoicesPage.discountTypeDropdownCss);
};

export const selectDiscountTypeFromDropdown = async (text) => {
	await clickElementByText(InvoicesPage.dropdownOptionCss, text);
};

export const contactDropdownVisible = async () => {
	await verifyElementIsVisible(InvoicesPage.organizationContactDropdownCss);
};

export const clickContactDropdown = async () => {
	// ga-contact-select is an ng-select (opens on mousedown, options appendTo body): open via the keyboard.
	await settleForm();
	await getPage().locator(`${InvoicesPage.organizationContactDropdownCss} input`).first().focus().catch(() => {});
	await getPage().keyboard.press('ArrowDown').catch(() => {});
};

export const selectContactFromDropdown = async (nameOrIndex) => {
	// The contact is REQUIRED (form.invalid disables Save) and it is what scopes every later row operation
	// (the grid's Contact column shows it), so the pick must really commit. Typeahead-filter to the
	// scenario's unique faker contact (ga-contact-select searchFn = name.includes(term)), click it, and
	// prove the commit against `div.ng-value` (only rendered once a value is bound). The control has
	// [addTag]="true": an "Add item" row (span.ng-tag-label) also contains the typed name and would create
	// a NEW contact — it is excluded. Always click (even on edit, where the contact is already set) so the
	// single-select panel closes; an open panel would sit over the fields below.
	const page = getPage();
	const byName = typeof nameOrIndex === 'string';
	const control = page.locator(InvoicesPage.organizationContactDropdownCss).first();
	const input = control.locator('input').first();
	const options = page.locator(realOptionSelector(InvoicesPage.contactOptionCss));
	const values = committedValues(InvoicesPage.organizationContactDropdownCss);
	const committed = async () =>
		byName
			? (await values.first().innerText().catch(() => '')).toLowerCase().includes(String(nameOrIndex).toLowerCase())
			: (await values.count().catch(() => 0)) > 0;
	for (let attempt = 0; attempt < 3; attempt++) {
		for (let i = 0; i < 5 && !(await options.first().isVisible().catch(() => false)); i++) {
			await settleForm();
			await input.focus().catch(() => {});
			await page.keyboard.press('ArrowDown').catch(() => {});
			await page.waitForTimeout(700);
		}
		let target = options.nth(byName ? 0 : Number(nameOrIndex));
		if (byName) {
			await input.fill(String(nameOrIndex)).catch(() => {});
			await page.waitForTimeout(500);
			target = options.filter({ hasText: String(nameOrIndex), hasNot: page.locator('.ng-tag-label') }).first();
		}
		if (await target.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)) {
			await target.click({ force: true }).catch(() => {});
			await page.waitForTimeout(500);
		}
		if (await committed()) {
			await page.locator('ng-dropdown-panel').first().waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
			return;
		}
	}
	throw new Error(`selectContactFromDropdown: contact "${nameOrIndex}" could not be selected on the invoice form`);
};

export const taxInputVisible = async () => {
	await verifyElementIsVisible(InvoicesPage.taxInputCss);
};

export const enterTaxData = async (data) => {
	await clearField(InvoicesPage.taxInputCss);
	await enterInput(InvoicesPage.taxInputCss, data);
};

export const taxTypeDropdownVisible = async () => {
	await verifyElementIsVisible(InvoicesPage.taxTypeDropdownCss);
};

export const clickTaxTypeDropdown = async () => {
	await clickButton(InvoicesPage.taxTypeDropdownCss);
};

export const selectTaxTypeFromDropdown = async (text) => {
	await clickElementByText(InvoicesPage.dropdownOptionCss, text);
};

export const invoiceTypeDropdownVisible = async () => {
	await verifyElementIsVisible(InvoicesPage.invoiceTypeDropdownCss);
};

export const clickInvoiceTypeDropdown = async () => {
	await clickButton(InvoicesPage.invoiceTypeDropdownCss);
};

export const selectInvoiceTypeFromDropdown = async (text) => {
	await clickElementByText(InvoicesPage.dropdownOptionCss, text);
};

export const employeeDropdownVisible = async () => {
	// ga-employee-multi-select renders its nb-select only once the working employees loaded (`loaded`).
	await verifyElementIsVisible(InvoicesPage.selectEmployeeCss);
};

export const clickEmployeeDropdown = async () => {
	await settleForm();
	await clickButton(InvoicesPage.selectEmployeeCss);
};

export const selectEmployeeFromDropdown = async (index) => {
	// With "By Employee Hours", invoice-add.generateTable() only builds line items for the selected
	// employees, and Save as Draft aborts with NO_ITEMS (persisting nothing) on an empty table — so the
	// pick must register. Open the multi nb-select until an option renders, click the option ONCE and
	// poll its `selected` class (a second blind click would toggle it off), then close the overlay with
	// Escape (nb-select closes on Escape) so it cannot intercept the Generate/Save clicks.
	const page = getPage();
	const option = page.locator(InvoicesPage.employeeOptionCss);
	for (let attempt = 0; attempt < 4; attempt++) {
		if (await option.first().isVisible().catch(() => false)) break;
		await clickButton(InvoicesPage.selectEmployeeCss).catch(() => {});
		await page.waitForTimeout(800);
	}
	await option
		.first()
		.waitFor({ state: 'visible', timeout: 12000 })
		.catch(() => {
			throw new Error('selectEmployeeFromDropdown: the employee select has no options (no working employee)');
		});
	const picked = option.nth(index);
	const isSelected = async () => /\bselected\b/.test((await picked.getAttribute('class').catch(() => '')) || '');
	for (let attempt = 0; attempt < 2 && !(await isSelected()); attempt++) {
		await picked.click({ force: true }).catch(() => {});
		await expect.poll(isSelected, { timeout: 3000 }).toBe(true).catch(() => {});
	}
	await page.keyboard.press('Escape').catch(() => {});
	await option.first().waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const generateItemsButtonVisible = async () => {
	await verifyElementIsVisible(InvoicesPage.generateItemsButtonCss);
};

export const clickGenerateItemsButton = async () => {
	// Click Generate, then wait for at least one generated line-item row (Save as Draft needs items).
	// Re-dispatch if none appeared — the first click can land while the form spinner is still up.
	const page = getPage();
	const itemRow = page.locator(InvoicesPage.generatedItemRowCss).first();
	for (let attempt = 0; attempt < 3; attempt++) {
		await settleForm();
		await page.locator(InvoicesPage.generateItemsButtonCss).first().dispatchEvent('click').catch(() => {});
		try {
			await itemRow.waitFor({ state: 'visible', timeout: 5000 });
			return;
		} catch {
			/* no rows yet — dispatch again */
		}
	}
};

export const saveAsDraftButtonVisible = async () => {
	await verifyElementIsVisible(InvoicesPage.saveAsDraftButtonCss);
};

export const clickSaveAsDraftButton = async (text) => {
	// addInvoice()/updateInvoice() navigate back to the list ONLY after the record persisted; a NO_ITEMS /
	// INVALID_DATES / duplicate-number abort keeps the form open. So: wait for Save to be enabled (it is
	// `[disabled]="disableSaveButton || form.invalid"`), dispatch, and require the route to leave
	// /add | /edit. Fail HERE if it never does — otherwise the next Draft-badge check could be satisfied
	// by an older row and hide that nothing was saved.
	const page = getPage();
	const button = page.locator(InvoicesPage.saveAsDraftButtonCss).filter({ hasText: text }).first();
	for (let attempt = 0; attempt < 2; attempt++) {
		await settleForm();
		await expect(button).toBeEnabled({ timeout: 15000 }).catch(() => {});
		await button.dispatchEvent('click').catch(() => {});
		try {
			await page.waitForFunction(() => !/\/(add|edit)(\b|\/|$)/.test(location.hash), undefined, { timeout: 20000 });
			await settleGrid();
			return;
		} catch {
			/* still on the form — retry once */
		}
	}
	throw new Error(`clickSaveAsDraftButton: "${text}" did not save the invoice (still on ${await page.evaluate(() => location.hash)})`);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(InvoicesPage.tableRowCss);
};

export const selectTableRow = async (index: number | string, name?: string) => {
	const indexOrName = name ?? index;
	// Row clicks TOGGLE selection (angular2-smart-table DataSet.selectRow), and a grid refresh
	// (invoices$ -> _clearItem) drops it, so: close the actions popover, let the grid settle, then click
	// only when the row is not already selected and confirm the selection held. Rows are scoped by the
	// scenario's unique contact name (grid Contact column) so a foreign row is never used. The click goes
	// to the first cell (invoice number) — the Contact cell's link navigates to the contact page.
	const page = getPage();
	await closeActionsPopover();
	await settleGrid();
	const rows = page.locator(InvoicesPage.tableRowCss);
	const row = typeof indexOrName === 'string' ? rows.filter({ hasText: indexOrName }).first() : rows.nth(indexOrName);
	await row.waitFor({ state: 'visible', timeout: 20000 });
	const editBtn = page.locator(InvoicesPage.editButtonCss).first();
	const isSelected = async () => {
		if (!(await editBtn.isEnabled().catch(() => false))) return false;
		if (/\bselected\b/.test((await row.getAttribute('class').catch(() => '')) || '')) return true;
		// Edit is enabled but this row lacks the class: only accept if NO row carries it (class not rendered).
		return (await page.locator(`${InvoicesPage.tableRowCss}.selected`).count().catch(() => 0)) === 0;
	};
	for (let attempt = 0; attempt < 5; attempt++) {
		if (!(await isSelected())) {
			await row.locator('td').first().click({ force: true, timeout: 10000 }).catch(() => {});
		}
		const ok = await expect
			.poll(isSelected, { timeout: 4000 })
			.toBe(true)
			.then(() => true)
			.catch(() => false);
		if (ok) {
			await page.waitForTimeout(400);
			if (await isSelected()) return;
		}
		await settleGrid();
	}
	throw new Error(`selectTableRow: could not select the invoice row for "${indexOrName}"`);
};

export const actionButtonVisible = async () => {
	await verifyElementIsVisible(InvoicesPage.popoverButtonCss);
};

/** Click a "more" popover action once it is enabled (Send is [disabled]="!canBeSend", the rest "disableButton"). */
const clickPopoverAction = async (button: Locator, label: string, rowName?: string) => {
	const page = getPage();
	for (let attempt = 0; attempt < 3; attempt++) {
		await clickMoreButton();
		await button.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
		if (await button.isEnabled().catch(() => false)) {
			// Dispatched straight at the button: Angular's (click) runs, and the popover closes itself
			// (its gauzyOutside handler sees a click inside).
			await button.dispatchEvent('click');
			return;
		}
		// Disabled => the row lost its selection (a grid refresh). Re-select it and reopen the popover.
		if (rowName) await selectTableRow(0, rowName);
		else await page.waitForTimeout(800);
	}
	throw new Error(`"${label}" stayed disabled in the actions popover — no invoice row is selected`);
};

export const clickActionButtonByText = async (text, rowName?: string) => {
	const button = getPage().locator(InvoicesPage.popoverButtonCss).filter({ hasText: text }).first();
	await clickPopoverAction(button, text, rowName);
};

export const backButtonVisible = async () => {
	await verifyElementIsVisible(InvoicesPage.backButtonCss);
};

export const clickBackButton = async () => {
	// goBack() = location.back() to the list (the edit/view page was pushed from it).
	const page = getPage();
	for (let attempt = 0; attempt < 2; attempt++) {
		await settleForm();
		await page.locator(InvoicesPage.backButtonCss).first().dispatchEvent('click').catch(() => {});
		try {
			await page.waitForFunction(() => !/\/(edit|view)\//.test(location.hash), undefined, { timeout: 10000 });
			break;
		} catch {
			/* still there — retry */
		}
	}
	await page.locator(InvoicesPage.addButtonCss).first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
	await settleGrid();
};

export const confirmButtonVisible = async () => {
	await verifyElementIsVisible(InvoicesPage.dialogConfirmButtonCss);
};

export const clickConfirmButton = async () => {
	// Confirm button of the Send (ga-invoice-send) / Email (ga-invoice-email) dialog. send()/sendEmail()
	// await the API update and only then close the dialog, so the proof the mutation ran is the dialog
	// host DETACHING. Wait for the button to be enabled (Email's Send is [disabled]="form.invalid"), click
	// it once (real click; dispatch as fallback), and give the awaited request a generous window before
	// clicking again — a re-click while the first request is in flight would send twice.
	const page = getPage();
	// The dialog host is an inline custom element, so wait on its confirm BUTTON for visibility and on the
	// host only for detachment.
	const dialog = page.locator(InvoicesPage.mutationDialogCss).first();
	const confirm = page.locator(InvoicesPage.dialogConfirmButtonCss).first();
	await confirm.waitFor({ state: 'visible', timeout: 15000 });
	for (let attempt = 0; attempt < 3; attempt++) {
		if ((await dialog.count().catch(() => 0)) === 0) break;
		await expect(confirm).toBeEnabled({ timeout: 10000 }).catch(() => {});
		await confirm.click({ timeout: 6000 }).catch(async () => {
			await confirm.dispatchEvent('click').catch(() => {});
		});
		try {
			await dialog.waitFor({ state: 'detached', timeout: 25000 });
			break;
		} catch {
			/* still open — click again */
		}
	}
	if ((await page.locator(InvoicesPage.mutationDialogCss).count().catch(() => 0)) > 0) {
		throw new Error('clickConfirmButton: the send/email dialog never closed — the invoice was not sent');
	}
	await settleGrid();
};

export const emailInputVisible = async () => {
	await verifyElementIsVisible(InvoicesPage.emailInputCss);
};

export const enterEmailData = async (data) => {
	await enterInput(InvoicesPage.emailInputCss, data);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(InvoicesPage.editButtonCss);
};

export const clickEditButton = async (index) => {
	// edit() navigates to /invoices/edit/:id, where getInvoiceById() fills the form asynchronously with
	// form.setValue(...) — which would overwrite anything typed before it lands. Wait for the route AND
	// for the record to be in the form (invoice number filled, spinner gone) before the step edits it.
	void index;
	const page = getPage();
	const button = page.locator(InvoicesPage.editButtonCss).first();
	for (let attempt = 0; attempt < 2; attempt++) {
		await expect(button).toBeEnabled({ timeout: 10000 }).catch(() => {});
		await button.dispatchEvent('click').catch(() => {});
		try {
			await page.waitForFunction(() => /\/edit\//.test(location.hash), undefined, { timeout: 15000 });
			break;
		} catch {
			/* still on the list — retry */
		}
	}
	await page
		.waitForFunction(
			(css) => {
				const el = document.querySelector(css) as HTMLInputElement | null;
				return !!el && el.value !== '';
			},
			InvoicesPage.editFormInvoiceNumberCss,
			{ timeout: 20000 }
		)
		.catch(() => {});
	await settleForm();
};

export const viewButtonVisible = async () => {
	await verifyElementIsVisible(InvoicesPage.viewButtonCss);
};

export const clickViewButton = async (index) => {
	// Single View button in the toolbar (the step's index is a Cypress-era artifact). view() navigates
	// to /invoices/view/:id.
	void index;
	const page = getPage();
	const button = page.locator(InvoicesPage.viewButtonCss).first();
	for (let attempt = 0; attempt < 2; attempt++) {
		await expect(button).toBeEnabled({ timeout: 10000 }).catch(() => {});
		await button.dispatchEvent('click').catch(() => {});
		try {
			await page.waitForFunction(() => /\/view\//.test(location.hash), undefined, { timeout: 15000 });
			return;
		} catch {
			/* still on the list — retry */
		}
	}
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(InvoicesPage.deleteButtonCss);
};

export const clickDeleteButton = async (rowName?: string) => {
	// Popover Delete action ([disabled]="disableButton") — opens the ga-delete-confirmation dialog.
	await clickPopoverAction(getPage().locator(InvoicesPage.deleteButtonCss).first(), 'Delete', rowName);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(InvoicesPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await getPage().locator(InvoicesPage.confirmDeleteButtonCss).first().dispatchEvent('click');
};

export const verifyEstimateExists = async (val) => {
	await verifyValue(InvoicesPage.verifyInvoiceCss, val);
};

export const setStatusButtonVisible = async () => {
	await verifyElementIsVisible(InvoicesPage.setStatusButtonCss);
};

export const clickSetStatusButton = async (text) => {
	// The toolbar "Set Status" nb-select ([disabled]="disableButton"); its placeholder reads "Set Status"
	// (hasText is case-insensitive, so the pagedata 'SET STATUS' matches). Force click opens it; the row
	// selection of the step before enabled it.
	await clickElementByText(InvoicesPage.setStatusButtonCss, text);
};

export const setStatusFromDropdown = async (text) => {
	// selectStatus() PUTs /invoices/:id/action {status}; wait for it so the next step starts from the
	// refreshed grid rather than racing the update.
	const page = getPage();
	const updated = page
		.waitForResponse((res) => res.request().method() === 'PUT' && /\/invoices\/[^/?]+\/action/.test(res.url()), {
			timeout: 20000
		})
		.catch(() => null);
	await clickElementByText(InvoicesPage.dropdownOptionCss, text);
	await updated;
	await settleGrid();
};

export const verifyDraftBadgeClass = async () => {
	await verifyElementIsVisible(InvoicesPage.draftBadgeCss);
};

export const verifySentBadgeClass = async () => {
	await verifyElementIsVisible(InvoicesPage.successBadgeCss);
};

export const verifyElementIsDeleted = async (text) => {
	// "Invoice deleted" check: the confirmation dialog closed with OK (delete() then calls the API and
	// refreshes the grid). The grid can still hold other specs' invoices (e.g. the one EstimatesTest
	// converts), so an empty-grid check would be wrong, and the pagedata empty-grid text is stale
	// (the grid now says "You have not created any invoices.").
	void text;
	const page = getPage();
	await page.locator('ga-delete-confirmation').first().waitFor({ state: 'detached', timeout: 12000 });
	await settleGrid();
};

export const scrollEmailInviteTemplate = async () => {
	await scrollDown(InvoicesPage.emailCardCss);
};

export const moreButtonVisible = async () => {
	await verifyElementIsVisible(InvoicesPage.moreButtonCss);
};

export const clickMoreButton = async () => {
	// Open the toolbar actions popover (More = vertical dots; toggleActionsPopover()). It is a toggle, so
	// only dispatch when it is not already open, and confirm it opened.
	const page = getPage();
	const popover = page.locator(InvoicesPage.popoverCss).first();
	for (let attempt = 0; attempt < 3; attempt++) {
		if (await popover.isVisible().catch(() => false)) return;
		await page.locator(InvoicesPage.listSpinnerCss).first().waitFor({ state: 'detached', timeout: 4000 }).catch(() => {});
		await page.locator(InvoicesPage.moreButtonCss).first().dispatchEvent('click').catch(() => {});
		await popover.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
	}
};

export const verifyTabButtonVisible = async () => {
	await verifyElementIsVisible(InvoicesPage.tabButtonCss);
};

export const clickTabButton = async (index) => {
	await clickButtonByIndex(InvoicesPage.tabButtonCss, index);
};

export const verifyEstimateNumberInputVisible = async () => {
	await verifyElementIsVisible(InvoicesPage.inputInvoiceNumberCss);
};

export const enterEstimateNumberInputData = async (data) => {
	await clearField(InvoicesPage.inputInvoiceNumberCss);
	await enterInput(InvoicesPage.inputInvoiceNumberCss, data);
};

export const verifyEstimateDateInput = async () => {
	await verifyElementIsVisible(InvoicesPage.estimateDateCss);
};

export const verifyEstimateDueDateInput = async () => {
	await verifyElementIsVisible(InvoicesPage.dueDateInputCss);
};

export const verifyTotalValueInputVisible = async () => {
	await verifyElementIsVisible(InvoicesPage.totalValueInputCss);
};

export const verifyCurrencyDropdownVisible = async () => {
	await verifyElementIsVisible(InvoicesPage.currencySelectCss);
};

export const verifyStatusInputVisible = async () => {
	await verifyElementIsVisible(InvoicesPage.inputStatusCss);
};

export const searchButtonVisible = async () => {
	await verifyElementIsVisible(InvoicesPage.searchButtonCss);
};

export const clickSearchButton = async () => {
	await clickButton(InvoicesPage.searchButtonCss);
	await settleGrid();
};

export const verifyDraftBadgeNotVisible = async () => {
	await verifyElementIsNotVisible(InvoicesPage.draftBadgeCss);
};

export const resetButtonVisible = async () => {
	await verifyElementIsVisible(InvoicesPage.resetButtonCss);
};

export const clickResetButton = async () => {
	await clickButton(InvoicesPage.resetButtonCss);
	await settleGrid();
};

export const verifyMoreButton = async () => {
	await verifyElementIsVisible(InvoicesPage.moreButtonCss);
};
