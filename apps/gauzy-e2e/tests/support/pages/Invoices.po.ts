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
	verifyText,
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
	// (appended to <body>).
	for (let i = 0; i < 4; i++) {
		if (await option.first().isVisible().catch(() => false)) break;
		await waitForSpinnerGone();
		await page.locator(`${InvoicesPage.addTagsDropdownCss} input`).first().focus().catch(() => {});
		await page.keyboard.press('ArrowDown').catch(() => {});
		await page.waitForTimeout(800);
	}
	await clickButtonByIndex(InvoicesPage.tagsDropdownOption, index);
};

export const clickCardBody = async () => clickButton(InvoicesPage.cardBodyCss);

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
	// Re-open the contact ng-select via keyboard until its options render, then pick one.
	for (let i = 0; i < 4; i++) {
		if (await option.first().isVisible().catch(() => false)) break;
		await waitForSpinnerGone();
		await page.locator(`${InvoicesPage.organizationContactDropdownCss} input`).first().focus().catch(() => {});
		await page.keyboard.press('ArrowDown').catch(() => {});
		await page.waitForTimeout(800);
	}
	await clickButtonByIndex(InvoicesPage.contactOptionCss, index);
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

export const clickEmployeeDropdown = async () => clickButton(InvoicesPage.selectEmployeeCss);

export const selectEmployeeFromDropdown = async (index: number) =>
	clickButtonByIndex(InvoicesPage.dropdownOptionCss, index);

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

export const selectTableRow = async (index: number) => {
	const page = getPage();
	// Settle the grid first: a row click TOGGLES selection, so a stray double-click would deselect it.
	// Wait for spinner/network/render to settle, then click the data row ONCE and poll the toolbar Edit
	// button's real `disabled` attr — only re-click if selection was lost. Never rapid re-click.
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const row = page.locator(InvoicesPage.tableRowCss).nth(index);
	const editBtn = page.locator(InvoicesPage.editButtonCss).first();
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
	// Send/Email confirm dialog button — dispatchClick so a lingering popover/dialog backdrop can't
	// intercept it.
	await waitForSpinnerGone();
	await dispatchClick(InvoicesPage.confirmButtonCss);
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

export const verifyElementIsDeleted = async (text: string) => verifyText(InvoicesPage.verifyInvoiceCss, text);

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
