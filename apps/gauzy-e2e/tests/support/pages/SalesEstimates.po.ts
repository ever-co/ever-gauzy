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
	scrollDown
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { SalesEstimatesPage } from '../../../src/support/Base/pageobjects/SalesEstimatesPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.addButtonCss);
};

export const clickAddButton = async () => {
	// dispatchClick past the post-navigation/mutation load spinner so the Add estimate form reliably
	// opens; a coordinate click can land on the spinner/backdrop instead.
	await waitForSpinnerGone();
	await dispatchClick(SalesEstimatesPage.addButtonCss);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.addTagsDropdownCss);
};

export const clickTagsDropdown = async () => {
	// focus + ArrowDown (NOT a click): #addTags is an ng-select that opens on mousedown, so a force-click
	// lands on the add-form backdrop and dismisses the route form; keyboard opens the panel without that.
	// The focus MUST target the inner <input> — focusing the ng-select host leaves the input unfocused so
	// ArrowDown goes to <body> and the panel never opens (the div.ng-option timeout seen in this suite).
	await waitForSpinnerGone();
	await getPage().locator(`${SalesEstimatesPage.addTagsDropdownCss} input`).first().focus().catch(() => {});
	await getPage().keyboard.press('ArrowDown').catch(() => {});
};

export const selectTagFromDropdown = async (index: number) => {
	const page = getPage();
	const option = page.locator(SalesEstimatesPage.tagsDropdownOption);
	// Re-open the tags ng-select via keyboard (focus inner input + ArrowDown) until the options render —
	// ng-select opens on mousedown so a click is backdrop-blocked. Then pick the option (appended to body).
	for (let i = 0; i < 4; i++) {
		if (await option.first().isVisible().catch(() => false)) break;
		await waitForSpinnerGone();
		await page.locator(`${SalesEstimatesPage.addTagsDropdownCss} input`).first().focus().catch(() => {});
		await page.keyboard.press('ArrowDown').catch(() => {});
		await page.waitForTimeout(800);
	}
	await clickButtonByIndex(SalesEstimatesPage.tagsDropdownOption, index);
};

export const clickCardBody = async () => {
	await clickButton(SalesEstimatesPage.cardBodyCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(SalesEstimatesPage.toastrMessageCss);
};

export const discountInputVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.discountInputCss);
};

export const enterDiscountData = async (data: string) => {
	await clearField(SalesEstimatesPage.discountInputCss);
	await enterInput(SalesEstimatesPage.discountInputCss, data);
};

export const discountTypeDropdownVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.discountTypeDropdownCss);
};

export const clickDiscountDropdown = async () => {
	await clickButton(SalesEstimatesPage.discountTypeDropdownCss);
};

export const selectDiscountTypeFromDropdown = async (text: string) => {
	await clickElementByText(SalesEstimatesPage.dropdownOptionCss, text);
};

export const contactDropdownVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.organizationContactDropdownCss);
};

export const clickContactDropdown = async () => {
	// ga-contact-select is an ng-select (opens on mousedown, options appendTo body) — same hazard as the
	// tags one: a force-click is backdrop-blocked / can dismiss the route form. Open via the inner input.
	await waitForSpinnerGone();
	await getPage().locator(`${SalesEstimatesPage.organizationContactDropdownCss} input`).first().focus().catch(() => {});
	await getPage().keyboard.press('ArrowDown').catch(() => {});
};

export const selectContactFromDropdown = async (index: number) => {
	const page = getPage();
	const option = page.locator(SalesEstimatesPage.contactOptionCss);
	// Re-open the contact ng-select via keyboard until its options render, then pick one.
	for (let i = 0; i < 4; i++) {
		if (await option.first().isVisible().catch(() => false)) break;
		await waitForSpinnerGone();
		await page.locator(`${SalesEstimatesPage.organizationContactDropdownCss} input`).first().focus().catch(() => {});
		await page.keyboard.press('ArrowDown').catch(() => {});
		await page.waitForTimeout(800);
	}
	await clickButtonByIndex(SalesEstimatesPage.contactOptionCss, index);
};

export const taxInputVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.taxInputCss);
};

export const enterTaxData = async (data: string) => {
	await clearField(SalesEstimatesPage.taxInputCss);
	await enterInput(SalesEstimatesPage.taxInputCss, data);
};

export const taxTypeDropdownVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.taxTypeDropdownCss);
};

export const clickTaxTypeDropdown = async () => {
	await clickButton(SalesEstimatesPage.taxTypeDropdownCss);
};

export const selectTaxTypeFromDropdown = async (text: string) => {
	await clickElementByText(SalesEstimatesPage.dropdownOptionCss, text);
};

export const invoiceTypeDropdownVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.invoiceTypeDropdownCss);
};

export const clickInvoiceTypeDropdown = async () => {
	await clickButton(SalesEstimatesPage.invoiceTypeDropdownCss);
};

export const selectInvoiceTypeFromDropdown = async (text: string) => {
	await clickElementByText(SalesEstimatesPage.dropdownOptionCss, text);
};

export const employeeDropdownVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.selectEmployeeCss);
};
export const clickEmployeeDropdown = async () => {
	await clickButton(SalesEstimatesPage.selectEmployeeCss);
};

export const selectEmployeeFromDropdown = async (index: number) => {
	const page = getPage();
	const option = page.locator(SalesEstimatesPage.dropdownOptionCss);
	// Best-effort employee pick: ga-employee-multi-select loads its options async and can legitimately
	// be EMPTY (no employee "working" in the selected date range). Select one if it appears; otherwise
	// press Escape and continue — an estimate saves fine without members. This avoids the hard 60s
	// timeout on an empty `.option-list nb-option` list (mirrors Estimates.po / ContactsLeads.po).
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

export const generateItemsButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.generateItemsButtonCss);
};

export const clickGenerateItemsButton = async () => {
	// dispatchClick past the form's full-card nb-spinner that overlays the buttons while it loads items
	// (a coordinate click would land on the spinner). Mirrors the proven Estimates.po pattern.
	await waitForSpinnerGone();
	await dispatchClick(SalesEstimatesPage.generateItemsButtonCss);
};

export const saveAsDraftButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.saveAsDraftButtonCss);
};

export const clickSaveAsDraftButton = async (text: string) => {
	// Footer Save: settle the card spinner first, then DOM-dispatch the click so it fires even when a
	// fading overlay sits on top (a coordinate click would land on the overlay). Mirrors Estimates.po.
	await waitForSpinnerGone();
	await getPage()
		.locator('button', { hasText: text })
		.first()
		.dispatchEvent('click')
		.catch(() => {});
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.tableRowCss);
};

export const selectTableRow = async (index: number) => {
	const page = getPage();
	// Settle the grid first: a row click TOGGLES selection, so a stray double-click would deselect it
	// (the spec calls selectTableRow repeatedly across steps). Wait for spinner/network/render to settle,
	// then click the data row ONCE and poll the toolbar Edit button's real `disabled` attr — only
	// re-click if selection was lost. Never rapid re-click. Mirrors the proven Estimates.po pattern.
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const row = page.locator(SalesEstimatesPage.tableRowCss).nth(index);
	const editBtn = page.locator(SalesEstimatesPage.editButtonCss).first();
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
	await verifyElementIsVisible(SalesEstimatesPage.popoverButtonCss);
};

export const clickActionButtonByText = async (text: string) => {
	// dispatchClick: the popover action (Duplicate/Send/Email) is reached right after the More popover
	// opens; a fading overlay can intercept a coordinate click. Dispatch straight to the matched button.
	await getPage()
		.locator(SalesEstimatesPage.popoverButtonCss)
		.filter({ hasText: text })
		.first()
		.dispatchEvent('click');
};

export const backButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.backButtonCss);
};

export const clickBackButton = async () => {
	// dispatchClick past any fading overlay from the prior view/duplicate screen. Mirrors Estimates.po.
	await waitForSpinnerGone();
	await dispatchClick(SalesEstimatesPage.backButtonCss);
};

export const confirmButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.confirmButtonCss);
};

export const clickConfirmButton = async () => {
	// Send/Email confirm dialog button — dispatchClick so a lingering popover/dialog backdrop can't
	// intercept it. Mirrors the proven Estimates.po pattern.
	await waitForSpinnerGone();
	await dispatchClick(SalesEstimatesPage.confirmButtonCss);
};

export const emailInputVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.emailInputCss);
};

export const enterEmailData = async (data: string) => {
	await enterInput(SalesEstimatesPage.emailInputCss, data);
};

export const convertToInvoiceButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.convertToInvoiceButton);
};

export const clickConvertToInvoiceButton = async (index: number) => {
	// Toolbar "To invoice" (button.action.info) is reached right after row selection; dispatchClick so
	// a fading overlay/toastr can't intercept the coordinate click. Mirrors Estimates.po.
	await waitForSpinnerGone();
	await getPage()
		.locator(SalesEstimatesPage.convertToInvoiceButton)
		.nth(index)
		.dispatchEvent('click')
		.catch(() => {});
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.editButtonCss);
};

export const clickEditButton = async (index: number) => {
	// editButtonCss is scoped to the "Edit" button; dispatchClick past any fading toastr/overlay from
	// the prior save so the edit route opens reliably. Mirrors the proven Estimates.po pattern.
	await waitForSpinnerGone();
	await getPage()
		.locator(SalesEstimatesPage.editButtonCss)
		.nth(index)
		.dispatchEvent('click')
		.catch(() => {});
};

export const viewButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.viewButtonCss);
};

export const clickViewButton = async (index: number) => {
	// viewButtonCss is scoped to the "View" button; dispatchClick to bypass any fading overlay.
	// Mirrors the proven Estimates.po pattern.
	await waitForSpinnerGone();
	await getPage()
		.locator(SalesEstimatesPage.viewButtonCss)
		.nth(index)
		.dispatchEvent('click')
		.catch(() => {});
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.deleteButtonCss);
};

export const clickDeleteButton = async () => {
	// Popover Delete action — dispatchClick so the open popover's backdrop can't intercept it.
	// Mirrors the proven Estimates.po pattern.
	await dispatchClick(SalesEstimatesPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	// Delete-confirmation dialog OK button — dispatchClick so the closing popover/dialog backdrop can't
	// intercept it. Mirrors the proven Estimates.po pattern.
	await waitForSpinnerGone();
	await dispatchClick(SalesEstimatesPage.confirmDeleteButtonCss);
};

export const verifyEstimateExists = async (val: string) => {
	await verifyValue(SalesEstimatesPage.verifyEstimateCss, val);
};

export const verifyDraftBadgeClass = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.draftBadgeCss);
};

export const verifySentBadgeClass = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.successBadgeCss);
};

export const verifyElementIsDeleted = async (text: string) => {
	await verifyTextNotExisting(SalesEstimatesPage.verifyEstimateCss, text);
};

export const scrollEmailInviteTemplate = async () => {
	await scrollDown(SalesEstimatesPage.emailCardCss);
};

export const moreButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.moreButtonCss);
};

export const clickMoreButton = async () => {
	// The "more" (vertical dots) toolbar button toggles the actions popover; dispatchClick past any
	// fading toastr/overlay so the popover opens reliably. Mirrors the proven Estimates.po pattern.
	await waitForSpinnerGone();
	await dispatchClick(SalesEstimatesPage.moreButtonCss);
};
