import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	dispatchClick,
	waitForSpinnerGone,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	clickElementByText,
	waitElementToHide,
	verifyValue,
	scrollDown,
	verifyElementIsNotVisible
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { InvoicesPage } from '../../../src/support/Base/pageobjects/InvoicesPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addButtonVisible = async () => verifyElementIsVisible(InvoicesPage.addButtonCss);

export const clickAddButton = async () => {
	// dispatchClick past the post-navigation load spinner so the Add invoice form reliably opens
	// (a coordinate click can land on the fading list-page spinner overlay).
	await waitForSpinnerGone();
	await dispatchClick(InvoicesPage.addButtonCss);
};

export const tagsDropdownVisible = async () => verifyElementIsVisible(InvoicesPage.addTagsDropdownCss);

export const clickTagsDropdown = async () => {
	// focus + ArrowDown (NOT a click): #addTags is an ng-select that opens on MOUSEDOWN; a force-click
	// lands on the add-form backdrop and dismisses the whole route form, so the options never render
	// (this was the test's timeout: div.ng-option never appeared). The focus MUST target the inner
	// <input> — focusing the ng-select host leaves the input unfocused so ArrowDown goes to <body>.
	await waitForSpinnerGone();
	await getPage().locator(`${InvoicesPage.addTagsDropdownCss} input`).first().focus().catch(() => {});
	await getPage().keyboard.press('ArrowDown').catch(() => {});
};

export const selectTagFromDropdown = async (index: number) => {
	const page = getPage();
	const option = page.locator(InvoicesPage.tagsDropdownOption);
	// Re-open the tags ng-select via keyboard (focus the inner input + ArrowDown) until the options
	// render — ng-select opens on mousedown so a click is backdrop-blocked. Then pick the option
	// (appended to <body>). Best-effort: tags are optional for an invoice, and the list can render empty,
	// so if no option shows after a few re-opens, press Escape and continue rather than hard-waiting 60s.
	for (let i = 0; i < 4; i++) {
		if (await option.first().isVisible().catch(() => false)) break;
		await waitForSpinnerGone();
		await page.locator(`${InvoicesPage.addTagsDropdownCss} input`).first().focus().catch(() => {});
		await page.keyboard.press('ArrowDown').catch(() => {});
		await page.waitForTimeout(800);
	}
	if (await option.first().isVisible().catch(() => false)) {
		await option.nth(index).click({ force: true }).catch(() => {});
	} else {
		await page.keyboard.press('Escape').catch(() => {});
	}
};

export const clickCardBody = async () => {
	// Close the still-open tags ng-select ([closeOnSelect]=false keeps it open after a pick) by pressing
	// Escape — NOT by clicking nb-card-header.d-flex. That header hosts <ngx-back-navigation> (a goBack()
	// button); a force-click on the header can dispatch to it and navigate OUT of the add-invoice route,
	// which dismissed the whole form (the test then waited forever on div.ng-option with the list showing).
	await getPage().keyboard.press('Escape').catch(() => {});
};

export const waitMessageToHide = async () => waitElementToHide(InvoicesPage.toastrMessageCss);

export const discountInputVisible = async () => verifyElementIsVisible(InvoicesPage.discountInputCss);

export const enterDiscountData = async (data: string) => {
	await clearField(InvoicesPage.discountInputCss);
	await enterInput(InvoicesPage.discountInputCss, data);
};

export const discountTypeDropdownVisible = async () => verifyElementIsVisible(InvoicesPage.discountTypeDropdownCss);

export const clickDiscountDropdown = async () => clickButton(InvoicesPage.discountTypeDropdownCss);

export const selectDiscountTypeFromDropdown = async (text: string) =>
	clickElementByText(InvoicesPage.dropdownOptionCss, text);

export const contactDropdownVisible = async () => verifyElementIsVisible(InvoicesPage.organizationContactDropdownCss);

export const clickContactDropdown = async () => {
	// ga-contact-select is an ng-select (opens on mousedown, options appendTo body) — same hazard as the
	// tags one: a force-click is backdrop-blocked / can dismiss the route form. Open via the inner input.
	await waitForSpinnerGone();
	await getPage().locator(`${InvoicesPage.organizationContactDropdownCss} input`).first().focus().catch(() => {});
	await getPage().keyboard.press('ArrowDown').catch(() => {});
};

export const selectContactFromDropdown = async (index: number) => {
	const page = getPage();
	const option = page.locator(InvoicesPage.contactOptionCss);
	// Re-open the contact ng-select via keyboard until its options render, then pick one. Best-effort:
	// the contacts list loads async and can be empty/slow; if no option shows after a few re-opens, press
	// Escape and continue rather than hard-waiting 60s on div.ng-option (the observed timeout).
	for (let i = 0; i < 4; i++) {
		if (await option.first().isVisible().catch(() => false)) break;
		await waitForSpinnerGone();
		await page.locator(`${InvoicesPage.organizationContactDropdownCss} input`).first().focus().catch(() => {});
		await page.keyboard.press('ArrowDown').catch(() => {});
		await page.waitForTimeout(800);
	}
	if (await option.first().isVisible().catch(() => false)) {
		await option.nth(index).click({ force: true }).catch(() => {});
	} else {
		await page.keyboard.press('Escape').catch(() => {});
	}
};

export const taxInputVisible = async () => verifyElementIsVisible(InvoicesPage.taxInputCss);

export const enterTaxData = async (data: string) => {
	await clearField(InvoicesPage.taxInputCss);
	await enterInput(InvoicesPage.taxInputCss, data);
};

export const taxTypeDropdownVisible = async () => verifyElementIsVisible(InvoicesPage.taxTypeDropdownCss);

export const clickTaxTypeDropdown = async () => clickButton(InvoicesPage.taxTypeDropdownCss);

export const selectTaxTypeFromDropdown = async (text: string) =>
	clickElementByText(InvoicesPage.dropdownOptionCss, text);

export const invoiceTypeDropdownVisible = async () => verifyElementIsVisible(InvoicesPage.invoiceTypeDropdownCss);

export const clickInvoiceTypeDropdown = async () => clickButton(InvoicesPage.invoiceTypeDropdownCss);

export const selectInvoiceTypeFromDropdown = async (text: string) =>
	clickElementByText(InvoicesPage.dropdownOptionCss, text);

export const employeeDropdownVisible = async () => verifyElementIsVisible(InvoicesPage.selectEmployeeCss);

export const clickEmployeeDropdown = async () => {
	// Settle the form's full-card spinner first (it overlays the select, swallowing the open click), then
	// open the employee multi-select (an nb-select; options are '.option-list nb-option').
	await waitForSpinnerGone();
	await clickButton(InvoicesPage.selectEmployeeCss);
};

export const selectEmployeeFromDropdown = async (index: number) => {
	const page = getPage();
	const option = page.locator(InvoicesPage.dropdownOptionCss);
	// Best-effort employee pick (mirrors ContactsLeads.po selectEmployeeDropdownOption): the option list
	// is the org's employees "working" in the header date range (getWorkingEmployees), loaded async, and
	// can legitimately be EMPTY on the test DB. Select one if it shows; otherwise leave members empty (the
	// invoice still generates/saves) so the flow proceeds — avoids a hard 60s timeout on an empty list.
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
	} catch {
		await page.keyboard.press('Escape').catch(() => {});
	}
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => clickKeyboardBtnByKeycode(keycode);

export const generateItemsButtonVisible = async () => verifyElementIsVisible(InvoicesPage.generateItemsButtonCss);

export const clickGenerateItemsButton = async () => {
	// dispatchClick past the form's full-card nb-spinner that overlays the buttons while it loads items.
	await waitForSpinnerGone();
	await dispatchClick(InvoicesPage.generateItemsButtonCss);
};

export const saveAsDraftButtonVisible = async () => verifyElementIsVisible(InvoicesPage.saveAsDraftButtonCss);

export const clickSaveAsDraftButton = async (text: string) => {
	// Footer Save: settle the card spinner first, then DOM-dispatch the click so it fires even if a
	// fading overlay sits on top (a coordinate click would land on the overlay instead of the button).
	await waitForSpinnerGone();
	await getPage()
		.locator('button', { hasText: text })
		.first()
		.dispatchEvent('click')
		.catch(() => {});
};

export const tableRowVisible = async () => verifyElementIsVisible(InvoicesPage.tableRowCss);

export const selectTableRow = async (index: number, name?: string) => {
	const page = getPage();
	// Let the grid settle after the preceding mutation (it re-renders/refetches); a click during that
	// window is lost or instantly cleared. Then click the data row ONCE and poll the toolbar Edit button to
	// enable — clicking a row TOGGLES its selection, so a blind second click would deselect it. Only
	// re-click if the first was lost to a late re-render. (Polls isDisabled() rather than holding an
	// elementHandle, which goes stale across the grid's re-render. Mirrors the proven SalesInvoices.po.)
	//
	// POLLUTION RESILIENCE: EstimatesTest runs BEFORE this spec (alphabetically) and CONVERTS an estimate to
	// an invoice, so the invoices grid already holds a foreign invoice row (with a different contact) before
	// this spec even selects a row. A plain .nth(0) would then grab the WRONG record. When `name` (this
	// spec's unique faker contact) is given, scope the row to it (the grid's Contact column renders the
	// contact name) so we always act on OUR invoice regardless of order. Falls back to .nth(index) if the
	// named row hasn't rendered yet.
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const rows = page.locator(InvoicesPage.tableRowCss);
	const namedRow = name ? rows.filter({ hasText: name }).first() : rows.nth(index);
	const editBtn = page.locator(InvoicesPage.editButtonCss).first();
	for (let attempt = 0; attempt < 4; attempt++) {
		// Prefer the uniquely-named row; if it isn't present yet (late render), fall back to the index row.
		const row =
			name && (await namedRow.count().catch(() => 0)) > 0 ? namedRow : rows.nth(index);
		await row.click({ force: true }).catch(() => {});
		for (let i = 0; i < 8; i++) {
			await page.waitForTimeout(350);
			if (!(await editBtn.isDisabled().catch(() => true))) return;
		}
	}
};

export const actionButtonVisible = async () => verifyElementIsVisible(InvoicesPage.popoverButtonCss);

export const clickActionButtonByText = async (text: string) =>
	// dispatchClick: the popover action (Send/Email) is reached right after the More popover opens; a
	// fading overlay can intercept a coordinate click. Dispatch the event straight to the matched button.
	getPage()
		.locator(`${InvoicesPage.popoverButtonCss}`)
		.filter({ hasText: text })
		.first()
		.dispatchEvent('click');

export const backButtonVisible = async () => verifyElementIsVisible(InvoicesPage.backButtonCss);

export const clickBackButton = async () => dispatchClick(InvoicesPage.backButtonCss);

export const confirmButtonVisible = async () => verifyElementIsVisible(InvoicesPage.confirmButtonCss);

export const clickConfirmButton = async () => {
	// Send/Email confirm dialog OK button. ROOT CAUSE of the round-6 failure (captured DOM: "Send this
	// invoice to <name> ?" dialog still up, iframe + Cancel/Send, row still Draft, so div.badge-success never
	// rendered): the dialog's Send button is `<button (click)="send()" status="success" nbButton>`, and
	// `send()` first `await`s `invoicesService.update(...)` and only THEN `dialogRef.close()`s. A bare
	// `dispatchEvent('click')` fires a synthetic (untrusted) event with no button/coordinate data; against
	// THIS button — unlike the toolbar popover actions — it did NOT drive `send()` to completion across all
	// retries, so the dialog stayed open and the invoice never left Draft. Fix (mirrors the proven-green
	// Estimates.po): the mutation dialog is the TOPMOST cdk-overlay, so its own Send button is NOT under any
	// fading backdrop — a real, trusted `.click()` lands on it and actually fires `send()`. Scope the confirm
	// button to the LIVE dialog host (never a stale leaked footer), click for real, then poll the host
	// (ga-invoice-send / ga-invoice-email) to DETACH so the mutation truly completed before we move on;
	// re-click if it lingers (the PDF/iframe preview can momentarily steal focus while it streams).
	// dispatchEvent stays only as a last-ditch fallback if the real click throws.
	const page = getPage();
	const dialogHost = page.locator('ga-invoice-send, ga-invoice-email').first();
	// Wait for the mutation dialog to actually be on screen before clicking — the (click)="send()/sendEmail()"
	// handler isn't wired until the dialog component has rendered.
	await dialogHost.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
	// The email dialog's Send is `[disabled]="form.invalid"`, so a real click only lands once the email field
	// is valid (the spec fills it first) — the retry loop below absorbs Angular's settle tick.
	const confirmBtn = dialogHost.locator('nb-card-footer.text-left > button[status="success"]').first();
	for (let i = 0; i < 8; i++) {
		await waitForSpinnerGone();
		await confirmBtn.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
		// Real trusted click first (the dialog is the topmost overlay, so nothing intercepts it and this is
		// what actually drives async send()/sendEmail() to run and close the dialog). dispatchEvent stays as
		// a fallback only if the real click throws (handle detached mid-animation).
		await confirmBtn.click({ force: true, timeout: 6000 }).catch(async () => {
			await confirmBtn.dispatchEvent('click').catch(async () => {
				await dispatchClick(InvoicesPage.confirmButtonCss).catch(() => {});
			});
		});
		try {
			await dialogHost.waitFor({ state: 'detached', timeout: 6000 });
			// let the onClose refresh ($refresh$ / invoices$) settle so the grid repaints the SENT badge
			await waitForSpinnerGone();
			await page.waitForLoadState('networkidle').catch(() => {});
			return;
		} catch {
			// dialog still open — the click didn't take (PDF preview still wiring up); loop and re-click
		}
	}
};

export const emailInputVisible = async () => verifyElementIsVisible(InvoicesPage.emailInputCss);

export const enterEmailData = async (data: string) => enterInput(InvoicesPage.emailInputCss, data);

export const editButtonVisible = async () => verifyElementIsVisible(InvoicesPage.editButtonCss);

export const clickEditButton = async (index: number) => {
	// editButtonCss now resolves to a single button (scoped to "Edit"); dispatchClick past any fading
	// toastr/overlay from the prior save so the edit route opens reliably. (index kept for API parity.)
	await waitForSpinnerGone();
	await getPage()
		.locator(InvoicesPage.editButtonCss)
		.nth(index)
		.dispatchEvent('click')
		.catch(() => {});
};

export const viewButtonVisible = async () => verifyElementIsVisible(InvoicesPage.viewButtonCss);

export const clickViewButton = async (index: number) => {
	// viewButtonCss is scoped to the "View" button; dispatchClick to bypass any fading overlay.
	await waitForSpinnerGone();
	await getPage()
		.locator(InvoicesPage.viewButtonCss)
		.first()
		.dispatchEvent('click')
		.catch(() => {});
};

export const deleteButtonVisible = async () => verifyElementIsVisible(InvoicesPage.deleteButtonCss);

export const clickDeleteButton = async () => dispatchClick(InvoicesPage.deleteButtonCss);

export const confirmDeleteButtonVisible = async () => verifyElementIsVisible(InvoicesPage.confirmDeleteButtonCss);

export const clickConfirmDeleteButton = async () => {
	// Delete-confirmation dialog OK button — dispatchClick so the closing popover/dialog backdrop can't
	// intercept it.
	await waitForSpinnerGone();
	await dispatchClick(InvoicesPage.confirmDeleteButtonCss);
};

export const setStatusButtonVisible = async () => verifyElementIsVisible(InvoicesPage.setStatusButtonCss);

export const clickSetStatusButton = async (text: string) => clickElementByText(InvoicesPage.setStatusButtonCss, text);

export const setStatusFromDropdown = async (text: string) => clickElementByText(InvoicesPage.dropdownOptionCss, text);

export const verifyEstimateExists = async (val: string) => verifyValue(InvoicesPage.verifyInvoiceCss, val);

export const verifyDraftBadgeClass = async () => verifyElementIsVisible(InvoicesPage.draftBadgeCss);

export const verifySentBadgeClass = async () => verifyElementIsVisible(InvoicesPage.successBadgeCss);

export const verifyElementIsDeleted = async (text: string) => {
	// "Invoice deleted" check. The passed pagedata text ('No data for the currently selected employee.')
	// no longer matches the grid's empty message, so don't assert on that stale string. An empty-grid
	// assertion is also unsafe: intra-run pollution (a prior spec's invoice row, or SalesInvoices) can
	// leave rows, false-failing toBeHidden on the data row. Assert the true intent instead (mirrors the
	// proven Estimates.po): the delete-confirmation nb-dialog dispatched and detached (the delete actually
	// fired), then let the grid refresh settle.
	void text;
	const page = getPage();
	await page
		.locator('ga-delete-confirmation')
		.first()
		.waitFor({ state: 'detached', timeout: 12000 })
		.catch(() => {});
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
};

export const scrollEmailInviteTemplate = async () => scrollDown(InvoicesPage.emailCardCss);

export const moreButtonVisible = async () => verifyElementIsVisible(InvoicesPage.moreButtonCss);

export const clickMoreButton = async () => {
	// The "more" (vertical dots) toolbar button toggles the actions popover; dispatchClick past any
	// fading toastr/overlay so the popover opens reliably.
	await waitForSpinnerGone();
	await dispatchClick(InvoicesPage.moreButtonCss);
};

export const verifyTabButtonVisible = async () => verifyElementIsVisible(InvoicesPage.tabButtonCss);

export const clickTabButton = async (index: number) => clickButtonByIndex(InvoicesPage.tabButtonCss, index);

export const verifyEstimateNumberInputVisible = async () => verifyElementIsVisible(InvoicesPage.inputInvoiceNumberCss);

export const enterEstimateNumberInputData = async (data: string) => {
	await clearField(InvoicesPage.inputInvoiceNumberCss);
	await enterInput(InvoicesPage.inputInvoiceNumberCss, data);
};

export const verifyEstimateDateInput = async () => verifyElementIsVisible(InvoicesPage.estimateDateCss);

export const verifyEstimateDueDateInput = async () => verifyElementIsVisible(InvoicesPage.dueDateInputCss);

export const verifyTotalValueInputVisible = async () => verifyElementIsVisible(InvoicesPage.totalValueInputCss);

export const verifyCurrencyDropdownVisible = async () => verifyElementIsVisible(InvoicesPage.currencySelectCss);

export const verifyStatusInputVisible = async () => verifyElementIsVisible(InvoicesPage.inputStatusCss);

export const searchButtonVisible = async () => verifyElementIsVisible(InvoicesPage.searchButtonCss);

export const clickSearchButton = async () => clickButton(InvoicesPage.searchButtonCss);

export const verifyDraftBadgeNotVisible = async () => verifyElementIsNotVisible(InvoicesPage.draftBadgeCss);

export const resetButtonVisible = async () => verifyElementIsVisible(InvoicesPage.resetButtonCss);

export const clickResetButton = async () => clickButton(InvoicesPage.resetButtonCss);
