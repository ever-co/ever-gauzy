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
	verifyTextNotExisting,
	scrollDown,
	verifyElementIsNotVisible
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { EstimatesPage } from '../../../src/support/Base/pageobjects/EstimatesPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.addButtonCss);
};

export const clickAddButton = async () => {
	// dispatchClick past the post-navigation load spinner so the Add estimate form reliably opens.
	await waitForSpinnerGone();
	await dispatchClick(EstimatesPage.addButtonCss);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.addTagsDropdownCss);
};

export const clickTagsDropdown = async () => {
	// focus + ArrowDown (NOT a click): a force-click on #addTags lands on the add-form backdrop and
	// dismisses the whole route form; keyboard opens the ng-select without that. The focus MUST target
	// the inner <input> — focusing the ng-select host element leaves the input unfocused so ArrowDown
	// goes to <body> and never opens the panel (this was the test's timeout: options never rendered).
	await waitForSpinnerGone();
	await getPage().locator(`${EstimatesPage.addTagsDropdownCss} input`).first().focus().catch(() => {});
	await getPage().keyboard.press('ArrowDown').catch(() => {});
};

export const selectTagFromDropdown = async (index) => {
	const page = getPage();
	const option = page.locator(EstimatesPage.tagsDropdownOption);
	// Re-open the tags ng-select via keyboard (focus the inner input + ArrowDown) until the options
	// render — ng-select opens on mousedown so a click is backdrop-blocked; focusing the host (not the
	// inner input) silently fails to open it. Then pick the option (appended to <body>).
	for (let i = 0; i < 4; i++) {
		if (await option.first().isVisible().catch(() => false)) break;
		await waitForSpinnerGone();
		await page.locator(`${EstimatesPage.addTagsDropdownCss} input`).first().focus().catch(() => {});
		await page.keyboard.press('ArrowDown').catch(() => {});
		await page.waitForTimeout(800);
	}
	await clickButtonByIndex(EstimatesPage.tagsDropdownOption, index);
};

export const clickCardBody = async () => {
	await clickButton(EstimatesPage.cardBodyCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(EstimatesPage.toastrMessageCss);
};

export const discountInputVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.discountInputCss);
};

export const enterDiscountData = async (data) => {
	await clearField(EstimatesPage.discountInputCss);
	await enterInput(EstimatesPage.discountInputCss, data);
};

export const discountTypeDropdownVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.discountTypeDropdownCss);
};

export const clickDiscountDropdown = async () => {
	await clickButton(EstimatesPage.discountTypeDropdownCss);
};

export const selectDiscountTypeFromDropdown = async (text) => {
	await clickElementByText(EstimatesPage.dropdownOptionCss, text);
};

export const contactDropdownVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.organizationContactDropdownCss);
};

export const clickContactDropdown = async () => {
	// ga-contact-select is an ng-select (opens on mousedown, options appendTo body) — same hazard as the
	// tags one: a force-click is backdrop-blocked / can dismiss the route form. Open via the inner input.
	await waitForSpinnerGone();
	await getPage().locator(`${EstimatesPage.organizationContactDropdownCss} input`).first().focus().catch(() => {});
	await getPage().keyboard.press('ArrowDown').catch(() => {});
};

export const selectContactFromDropdown = async (index) => {
	const page = getPage();
	const option = page.locator(EstimatesPage.contactOptionCss);
	// Re-open the contact ng-select via keyboard until its options render, then pick one.
	for (let i = 0; i < 4; i++) {
		if (await option.first().isVisible().catch(() => false)) break;
		await waitForSpinnerGone();
		await page.locator(`${EstimatesPage.organizationContactDropdownCss} input`).first().focus().catch(() => {});
		await page.keyboard.press('ArrowDown').catch(() => {});
		await page.waitForTimeout(800);
	}
	await clickButtonByIndex(EstimatesPage.contactOptionCss, index);
};

export const taxInputVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.taxInputCss);
};

export const enterTaxData = async (data) => {
	await clearField(EstimatesPage.taxInputCss);
	await enterInput(EstimatesPage.taxInputCss, data);
};

export const taxTypeDropdownVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.taxTypeDropdownCss);
};

export const clickTaxTypeDropdown = async () => {
	await clickButton(EstimatesPage.taxTypeDropdownCss);
};

export const selectTaxTypeFromDropdown = async (text) => {
	await clickElementByText(EstimatesPage.dropdownOptionCss, text);
};

export const invoiceTypeDropdownVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.invoiceTypeDropdownCss);
};

export const clickInvoiceTypeDropdown = async () => {
	await clickButton(EstimatesPage.invoiceTypeDropdownCss);
};

export const selectInvoiceTypeFromDropdown = async (text) => {
	await clickElementByText(EstimatesPage.dropdownOptionCss, text);
};

export const employeeDropdownVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.selectEmployeeCss);
};

export const clickEmployeeDropdown = async () => {
	await clickButton(EstimatesPage.selectEmployeeCss);
};

export const selectEmployeeFromDropdown = async (index) => {
	const page = getPage();
	const option = page.locator(EstimatesPage.dropdownOptionCss);
	// Best-effort employee pick: ga-employee-multi-select loads its options async and can legitimately
	// be EMPTY (no employee "working" in the selected date range). Select one if it appears; otherwise
	// press Escape and continue — an estimate saves fine without members. This avoids the hard 60s
	// timeout on an empty `.option-list nb-option` list (mirrors ContactsLeads.selectEmployeeDropdownOption).
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
	} catch {
		await page.keyboard.press('Escape').catch(() => {});
	}
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const generateItemsButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.generateItemsButtonCss);
};

export const clickGenerateItemsButton = async () => {
	// dispatchClick past the form's full-card nb-spinner that overlays the buttons while it loads items
	// (a coordinate click would land on the spinner). Mirrors the proven Invoices.po pattern.
	await waitForSpinnerGone();
	await dispatchClick(EstimatesPage.generateItemsButtonCss);
};

export const saveAsDraftButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.saveAsDraftButtonCss);
};

export const clickSaveAsDraftButton = async (text) => {
	// Footer Save: settle the card spinner first, then DOM-dispatch the click so it fires even when a
	// fading overlay sits on top (a coordinate click would land on the overlay). Mirrors Invoices.po.
	await waitForSpinnerGone();
	await getPage()
		.locator('button', { hasText: text })
		.first()
		.dispatchEvent('click')
		.catch(() => {});
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.tableRowCss);
};

export const selectTableRow = async (index) => {
	const page = getPage();
	// Settle the grid first: a row click TOGGLES selection, so a stray double-click would deselect it
	// (the spec calls selectTableRow twice in the duplicate step). Wait for spinner/network/render to
	// settle, then click the data row ONCE and poll the toolbar Edit button's real `disabled` attr —
	// only re-click if selection was lost. Never rapid re-click. Mirrors the proven Invoices.po pattern.
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const row = page.locator(EstimatesPage.tableRowCss).nth(index);
	const editBtn = page.locator(EstimatesPage.editButtonCss).first();
	for (let i = 0; i < 4; i++) {
		await row.click({ force: true }).catch(() => {});
		try {
			await page.waitForFunction(
				(el) => !!el && !(el as HTMLButtonElement).disabled,
				await editBtn.elementHandle(),
				{ timeout: 4000 }
			);
			return;
		} catch {
			// selection didn't enable the toolbar yet — loop and click the row again
		}
	}
};

export const actionButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.popoverButtonCss);
};

export const clickActionButtonByText = async (text) => {
	// dispatchClick: the popover action (Duplicate/Send/Email) is reached right after the More popover
	// opens; a fading overlay can intercept a coordinate click. Dispatch straight to the matched button.
	await getPage()
		.locator(EstimatesPage.popoverButtonCss)
		.filter({ hasText: text })
		.first()
		.dispatchEvent('click');
};

export const backButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.backButtonCss);
};

export const clickBackButton = async () => {
	// dispatchClick past any fading overlay from the prior view/duplicate screen.
	await waitForSpinnerGone();
	await dispatchClick(EstimatesPage.backButtonCss);
};

export const confirmButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.confirmButtonCss);
};

export const clickConfirmButton = async () => {
	// Send/Email confirm dialog button — dispatchClick so a lingering popover/dialog backdrop can't
	// intercept it. Mirrors the proven Invoices.po pattern.
	await waitForSpinnerGone();
	await dispatchClick(EstimatesPage.confirmButtonCss);
};

export const emailInputVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.emailInputCss);
};

export const enterEmailData = async (data) => {
	await enterInput(EstimatesPage.emailInputCss, data);
};

export const convertToInvoiceButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.convertToInvoiceButton);
};

export const clickConvertToInvoiceButton = async (index) => {
	// Toolbar "To invoice" (button.action.info) is reached right after row selection; dispatchClick so
	// a fading overlay/toastr can't intercept the coordinate click.
	await waitForSpinnerGone();
	await getPage()
		.locator(EstimatesPage.convertToInvoiceButton)
		.nth(index)
		.dispatchEvent('click')
		.catch(() => {});
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.editButtonCss);
};

export const clickEditButton = async (index) => {
	// editButtonCss is scoped to the "Edit" button; dispatchClick past any fading toastr/overlay from
	// the prior save so the edit route opens reliably. Mirrors the proven Invoices.po pattern.
	await waitForSpinnerGone();
	await getPage()
		.locator(EstimatesPage.editButtonCss)
		.nth(index)
		.dispatchEvent('click')
		.catch(() => {});
};

export const viewButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.viewButtonCss);
};

export const clickViewButton = async (index) => {
	// viewButtonCss is scoped to the "View" button; dispatchClick to bypass any fading overlay.
	await waitForSpinnerGone();
	await getPage()
		.locator(EstimatesPage.viewButtonCss)
		.nth(index)
		.dispatchEvent('click')
		.catch(() => {});
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.deleteButtonCss);
};

export const clickDeleteButton = async () => {
	// Popover Delete action — dispatchClick so the open popover's backdrop can't intercept it.
	await dispatchClick(EstimatesPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	// Delete-confirmation dialog OK button — dispatchClick so the closing popover/dialog backdrop can't
	// intercept it. Mirrors the proven Invoices.po pattern.
	await waitForSpinnerGone();
	await dispatchClick(EstimatesPage.confirmDeleteButtonCss);
};

export const verifyEstimateExists = async (val) => {
	await verifyValue(EstimatesPage.verifyEstimateCss, val);
};

export const verifyDraftBadgeClass = async () => {
	await verifyElementIsVisible(EstimatesPage.draftBadgeCss);
};

export const verifySentBadgeClass = async () => {
	await verifyElementIsVisible(EstimatesPage.successBadgeCss);
};

export const verifyElementIsDeleted = async (text) => {
	await verifyTextNotExisting(EstimatesPage.verifyEstimateCss, text);
};

export const scrollEmailInviteTemplate = async () => {
	await scrollDown(EstimatesPage.emailCardCss);
};

export const moreButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.moreButtonCss);
};

export const clickMoreButton = async () => {
	// The "more" (vertical dots) toolbar button toggles the actions popover; dispatchClick past any
	// fading toastr/overlay so the popover opens reliably. Mirrors the proven Invoices.po pattern.
	await waitForSpinnerGone();
	await dispatchClick(EstimatesPage.moreButtonCss);
};

export const verifyTabButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.tabButtonCss);
};

export const clickTabButton = async (index) => {
	await clickButtonByIndex(EstimatesPage.tabButtonCss, index);
};

export const verifyEstimateNumberInputVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.inputInvoiceNumberCss);
};

export const enterEstimateNumberInputData = async (data) => {
	await clearField(EstimatesPage.inputInvoiceNumberCss);
	await enterInput(EstimatesPage.inputInvoiceNumberCss, data);
};

export const verifyEstimateDateInput = async () => {
	await verifyElementIsVisible(EstimatesPage.estimateDateCss);
};

export const verifyEstimateDueDateInput = async () => {
	await verifyElementIsVisible(EstimatesPage.dueDateInputCss);
};

export const verifyTotalValueInputVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.totalValueInputCss);
};

export const verifyCurrencyDropdownVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.currencySelectCss);
};

export const verifyStatusInputVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.inputStatusCss);
};

export const searchButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.searchButtonCss);
};

export const clickSearchButton = async () => {
	await clickButton(EstimatesPage.searchButtonCss);
};

export const verifyDraftBadgeNotVisible = async () => {
	await verifyElementIsNotVisible(EstimatesPage.draftBadgeCss);
};

export const resetButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.resetButtonCss);
};

export const clickResetButton = async () => {
	await clickButton(EstimatesPage.resetButtonCss);
};

export const verifyMoreButton = async () => {
	await verifyElementIsVisible(EstimatesPage.moreButtonCss);
};
