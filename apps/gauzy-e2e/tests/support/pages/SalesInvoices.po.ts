import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	clickElementByText,
	waitElementToHide,
	clickButtonByText,
	verifyValue,
	scrollDown,
	clickButtonWithDelay,
	dispatchClick,
	waitForSpinnerGone,
	verifyByLength
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { SalesInvoicesPage } from '../../../src/support/Base/pageobjects/SalesInvoicesPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.addButtonCss);
};

export const clickAddButton = async () => {
	// First click after navigating here straight from addContact: the leads/contact mutation leaves
	// fading cdk-overlay backdrops and the invoices page shows a load spinner over the toolbar. Wait it
	// out then dispatch the click so the add-invoice form reliably opens (a coordinate click can land on
	// the spinner/backdrop). add() runs synchronously on the click event.
	await waitForSpinnerGone();
	await dispatchClick(SalesInvoicesPage.addButtonCss);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.addTagsDropdownCss);
};

export const clickTagsDropdown = async () => {
	// #addTags is an ng-select (opens on MOUSEDOWN); a coordinate/force click can be swallowed by a
	// lingering backdrop or even toggle the control shut. Open it via the keyboard: focus the inner
	// search input and press ArrowDown so the option panel (div.ng-option, appended to body) renders.
	const input = getPage().locator(SalesInvoicesPage.addTagsDropdownCss).locator('input').first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const selectTagFromDropdown = async (index: number) => {
	await clickButtonByIndex(SalesInvoicesPage.tagsDropdownOption, index);
};

export const clickCardBody = async () => {
	await clickButton(SalesInvoicesPage.cardBodyCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(SalesInvoicesPage.toastrMessageCss);
};

export const discountInputVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.discountInputCss);
};

export const enterDiscountData = async (data: string) => {
	await clearField(SalesInvoicesPage.discountInputCss);
	await enterInput(SalesInvoicesPage.discountInputCss, data);
};

export const discountTypeDropdownVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.discountTypeDropdownCss);
};

export const clickDiscountDropdown = async () => {
	await clickButton(SalesInvoicesPage.discountTypeDropdownCss);
};

export const selectDiscountTypeFromDropdown = async (text: string) => {
	await clickElementByText(SalesInvoicesPage.dropdownOptionCss, text);
};

export const contactDropdownVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.organizationContactDropdownCss);
};

export const clickContactDropdown = async () => {
	// ga-contact-select is an ng-select (opens on MOUSEDOWN, options render as div.ng-option appended to
	// body). Open via the keyboard rather than a click — a force-click can be intercepted by a fading
	// backdrop or close the control. ArrowDown opens the panel.
	const input = getPage()
		.locator(SalesInvoicesPage.organizationContactDropdownCss)
		.locator('input')
		.first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const selectContactFromDropdown = async (index: number) => {
	await clickButtonByIndex(SalesInvoicesPage.contactOptionCss, index);
};

export const taxInputVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.taxInputCss);
};

export const enterTaxData = async (data: string) => {
	await clearField(SalesInvoicesPage.taxInputCss);
	await enterInput(SalesInvoicesPage.taxInputCss, data);
};

export const taxTypeDropdownVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.taxTypeDropdownCss);
};

export const clickTaxTypeDropdown = async () => {
	await clickButton(SalesInvoicesPage.taxTypeDropdownCss);
};

export const selectTaxTypeFromDropdown = async (text: string) => {
	await clickElementByText(SalesInvoicesPage.dropdownOptionCss, text);
};

export const invoiceTypeDropdownVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.invoiceTypeDropdownCss);
};

export const clickInvoiceTypeDropdown = async () => {
	await clickButton(SalesInvoicesPage.invoiceTypeDropdownCss);
};

export const selectInvoiceTypeFromDropdown = async (text: string) => {
	await clickElementByText(SalesInvoicesPage.dropdownOptionCss, text);
};

export const employeeDropdownVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.selectEmployeeCss);
};
export const clickEmployeeDropdown = async () => {
	await clickButton(SalesInvoicesPage.selectEmployeeCss);
};

export const selectEmployeeFromDropdown = async (index: number) => {
	await clickButtonByIndex(SalesInvoicesPage.dropdownOptionCss, index);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const generateItemsButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.generateItemsButtonCss);
};

export const clickGenerateItemsButton = async () => {
	await clickButton(SalesInvoicesPage.generateItemsButtonCss);
};

export const saveAsDraftButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.saveAsDraftButtonCss);
};

export const clickSaveAsDraftButton = async (text: string) => {
	await clickButtonByText(text);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.tableRowCss);
};

export const selectTableRow = async (index: number) => {
	const page = getPage();
	// Let the grid settle after the preceding mutation (it re-renders/refetches); a click during that
	// window is lost or instantly cleared. Then click the row ONCE and poll the toolbar Edit button to
	// enable — clicking a row TOGGLES its selection, so a blind second click would deselect it. Only
	// re-click if the first was lost to a late re-render.
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const row = page.locator(SalesInvoicesPage.tableRowCss).nth(index);
	const editBtn = page.locator(SalesInvoicesPage.editButtonCss).first();
	for (let attempt = 0; attempt < 4; attempt++) {
		await row.click({ force: true });
		for (let i = 0; i < 8; i++) {
			await page.waitForTimeout(350);
			if (!(await editBtn.isDisabled().catch(() => true))) return;
		}
	}
};

export const actionButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.popoverButtonCss);
};

export const clickActionButtonByText = async (text: string) => {
	await clickElementByText(SalesInvoicesPage.popoverButtonCss, text);
};

export const backButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.backButtonCss);
};

export const clickBackButton = async () => {
	await clickButton(SalesInvoicesPage.backButtonCss);
};

export const confirmButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.confirmButtonCss);
};

export const clickConfirmButton = async () => {
	await clickButtonWithDelay(SalesInvoicesPage.confirmButtonCss);
};

export const emailInputVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.emailInputCss);
};

export const enterEmailData = async (data: string) => {
	await enterInput(SalesInvoicesPage.emailInputCss, data);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.editButtonCss);
};

export const clickEditButton = async (index: number) => {
	// dispatchClick: the just-completed save/draft mutation leaves a fading cdk-overlay backdrop over the
	// toolbar that swallows a coordinate click on Edit. Edit is index 0 (Download is the other
	// `action.primary`); dispatch fires edit(selectedInvoice) straight on the button.
	void index;
	await waitForSpinnerGone();
	await dispatchClick(SalesInvoicesPage.editButtonCss);
};

export const viewButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.viewButtonCss);
};

export const clickViewButton = async (index: number) => {
	// viewButtonCss is now scoped to the eye-outline (View) button only, so the index is irrelevant
	// (the old `1` actually hit Payments). dispatchClick: a lingering toolbar backdrop can swallow a
	// coordinate click; dispatch fires view() straight on the button.
	void index;
	await waitForSpinnerGone();
	await dispatchClick(SalesInvoicesPage.viewButtonCss);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.deleteButtonCss);
};

export const clickDeleteButton = async () => {
	await clickButton(SalesInvoicesPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(SalesInvoicesPage.confirmDeleteButtonCss);
};

export const setStatusButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.setStatusButtonCss);
};

export const clickSetStatusButton = async (text: string) => {
	await clickElementByText(SalesInvoicesPage.setStatusButtonCss, text);
};

export const setStatusFromDropdown = async (text: string) => {
	await clickElementByText(SalesInvoicesPage.dropdownOptionCss, text);
};

export const verifyEstimateExists = async (val: string) => {
	await verifyValue(SalesInvoicesPage.verifyInvoiceCss, val);
};

export const verifyDraftBadgeClass = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.draftBadgeCss);
};

export const verifySentBadgeClass = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.successBadgeCss);
};

export const verifyElementIsDeleted = async (text: string) => {
	// The original asserted a hard-coded empty-grid message, but the live invoices grid renders
	// "You have not created any invoices." (SM_TABLE.NO_DATA.INVOICE) — not the pagedata string, which
	// is stale and outside this spec's editable files. Assert the deletion the robust, message-agnostic
	// way: the lone invoice's data row is gone (no `tr.angular2-smart-row` remains).
	void text;
	await verifyByLength(SalesInvoicesPage.tableRowCss, 0);
};

export const scrollEmailInviteTemplate = async () => {
	await scrollDown(SalesInvoicesPage.emailCardCss);
};

export const moreButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.moreButtonCss);
};

export const clickMoreButton = async () => {
	// Clicked right after a row selection / prior mutation; a fading toolbar backdrop can swallow a
	// coordinate click. dispatch fires toggleActionsPopover() straight on the button so the actions
	// popover (Send/Email/Delete) opens reliably.
	await waitForSpinnerGone();
	await dispatchClick(SalesInvoicesPage.moreButtonCss);
};

export const verifyMoreButton = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.moreButtonCss);
};
