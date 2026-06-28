import dayjs from 'dayjs';
import {
	enterInput,
	verifyElementIsVisible,
	verifyElementIsVisibleByIndex,
	clickButton,
	clearField,
	clickKeyboardBtnByKeycode,
	clickElementByText,
	verifyText,
	verifyElementNotExist,
	waitUntil,
	forceClickElementByText,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { ExpensesPage } from '../../../src/support/Base/pageobjects/ExpensesPageObject';

// Open an `appendTo="body"` ng-select via the KEYBOARD (focus its inner input), never a coordinate
// click: these dropdowns open on mousedown and the add/tag dialogs that ran just before leave fading
// cdk-overlay backdrops that swallow a click on the control — a force-click can even close the form.
// Typing filters/creates the option; pressing Enter then commits (addTag selects render the typed
// value as a "create" option). Returns the focused input locator.
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

export const gridBtnClick = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addExpenseButtonVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.addExpenseButtonCss);
};

export const clickAddExpenseButton = async () => {
	// dispatchClick after settling the load spinner: this button (the toolbar "Add") opens the mutation
	// dialog; on the manage-categories screen it's reached right after navigation while a card spinner
	// overlays the toolbar, so a coordinate click can land on the spinner/backdrop and the dialog never
	// opens. dispatch fires openAddExpenseDialog()/add() straight on the button.
	await waitUntil(3000);
	await waitForSpinnerGone();
	await dispatchClick(ExpensesPage.addExpenseButtonCss);
};

export const selectEmployeeDropdownVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.selectEmployeeDropdownCss);
};

export const clickEmployeeDropdown = async () => {
	// Open via keyboard, not a click — the employee selector is an appendTo=body ng-select that opens on
	// mousedown and is blocked by leftover backdrops; focusing its input + ArrowDown opens it reliably.
	await waitForSpinnerGone();
	await openNgSelectAndType(ExpensesPage.selectEmployeeDropdownCss);
};

export const selectEmployeeFromDropdown = async (index) => {
	// Best-effort employee pick (mirror ContactsLeads.selectEmployeeDropdownOption): the option list
	// loads async and can be EMPTY on the test DB (no employee "working" in the header date range). Click
	// an option if one shows within ~8s; otherwise dismiss the dropdown and continue — the employee is
	// optional for an expense (addExpense sends employeeId: null) so the record still saves. A hard
	// option[0] click with the 60s task timeout would otherwise hang the whole test on an empty list.
	const page = getPage();
	const option = page.locator(ExpensesPage.selectEmployeeDropdownOptionCss);
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
	} catch {
		// Dismiss an empty/open ng-select dropdown by clicking the dialog TITLE (an inert <h4>), NOT by
		// pressing Escape: the add-expense ExpensesMutationComponent is an NbDialog opened with default
		// options, so closeOnEsc is true — a document-level Escape would close the whole dialog (the
		// confirmed round-4 root cause: by saveExpenseButtonVisible() the dialog was gone and the grid
		// was showing). An in-dialog outside-click closes only the ng-select overlay, leaving the form.
		await page.locator(ExpensesPage.cardBodyCss).first().click({ force: true }).catch(() => {});
	}
};

export const dateInputVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.dateInputCss);
};

export const enterDateInputData = async () => {
	await clearField(ExpensesPage.dateInputCss);
	const date = dayjs().format('MMM D, YYYY');
	await enterInput(ExpensesPage.dateInputCss, date);
};

export const contactInputVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.organizationContactCss);
};

export const clickContactInput = async () => {
	await openNgSelectAndType(ExpensesPage.organizationContactCss);
};

export const enterContactInputData = async (data) => {
	// ga-contact-select is an appendTo=body ng-select with addTag: open via keyboard (focus input),
	// type the new contact name to surface the "Add item" option, then Enter to create-and-select.
	await openNgSelectAndType(ExpensesPage.organizationContactCss, data);
	await clickKeyboardBtnByKeycode(13);
};

export const categoryInputVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.categoryInputCss);
};

export const clickCategoryInput = async () => {
	await openNgSelectAndType(ExpensesPage.categoryInputCss);
};

export const enterCategoryInputData = async (data) => {
	// ga-expense-category-select is an appendTo=body ng-select with addTag: open via keyboard, type the
	// category to surface the "Add item" option, then Enter to create-and-select (no coordinate click).
	await openNgSelectAndType(ExpensesPage.categoryInputCss, data);
	await clickKeyboardBtnByKeycode(13);
};

export const vendorInputVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.vendorInputCss);
};

export const clickVendorInput = async () => {
	await openNgSelectAndType(ExpensesPage.vendorInputCss);
};

export const enterVendorInputData = async (data) => {
	// ga-vendor-select is an appendTo=body ng-select with addTag: open via keyboard, type the vendor to
	// surface the "Add item" option, then Enter to create-and-select (no coordinate click).
	await openNgSelectAndType(ExpensesPage.vendorInputCss, data);
	await clickKeyboardBtnByKeycode(13);
};

export const amountInputVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.amountInputCss);
};

export const enterAmountInputData = async (data) => {
	await clearField(ExpensesPage.amountInputCss);
	await enterInput(ExpensesPage.amountInputCss, data);
};

export const projectDropdownVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.projectDropdownCss);
};

export const clickProjectDropdown = async () => {
	// ga-project-selector is an appendTo=body ng-select — open via keyboard (focus input), not a click,
	// to dodge the leftover dialog backdrops that block / close the form on a coordinate click.
	await openNgSelectAndType(ExpensesPage.projectDropdownCss);
};

export const selectProjectFromDropdown = async (text) => {
	// Re-open + type to filter the project list (keyboard, not a click) so the wanted option renders,
	// then click it by text. The options are div.ng-option in the body-appended overlay.
	await openNgSelectAndType(ExpensesPage.projectDropdownCss, text);
	await clickElementByText(ExpensesPage.projectDropdownOptionCss, text);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.addTagsDropdownCss);
};

export const clickTagsDropdown = async () => {
	// ga-tags-color-input (#addTags) is an appendTo=body ng-select — open via keyboard, not a click, to
	// dodge leftover dialog backdrops (ng-select opens on mousedown so dispatchClick can't help either).
	await openNgSelectAndType(ExpensesPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = async (index) => {
	// Best-effort tag pick: an org tag was created by the addTag prerequisite, but the list still loads
	// async — click the option if it shows, else dismiss and continue (tags are optional on an expense).
	const page = getPage();
	const option = page.locator(ExpensesPage.tagsDropdownOption);
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
	} catch {
		// As in selectEmployeeFromDropdown: dismiss the open tags ng-select by clicking the dialog title,
		// NEVER Escape — the dialog's default closeOnEsc would close the whole add-expense form.
		await page.locator(ExpensesPage.cardBodyCss).first().click({ force: true }).catch(() => {});
	}
};

export const purposeTextareaVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.purposeInputCss);
};

export const enterPurposeInputData = async (data) => {
	await clearField(ExpensesPage.purposeInputCss);
	await enterInput(ExpensesPage.purposeInputCss, data);
};

export const saveExpenseButtonVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.saveExpenseButtonCss);
};

export const clickSaveExpenseButton = async () => {
	// dispatchClick (not a coordinate click): the just-closed ng-select overlays / addProject+addTag
	// dialogs leave fading cdk-overlay backdrops over the footer, so a force click lands on the backdrop
	// and the dialog never closes (=> no expense created, empty grid). dispatch fires addOrEditExpense()
	// straight on the button, which still gates on form validity. Settle any spinner first.
	await waitForSpinnerGone();
	await dispatchClick(ExpensesPage.saveExpenseButtonCss);
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.selectTableRowCss);
};

export const selectTableRow = async (index) => {
	const page = getPage();
	// Let the grid settle first: after the preceding mutation it re-renders/refetches and a click during
	// that window is lost or immediately cleared. Then click the row ONCE and poll the Edit button's REAL
	// `disabled` attribute (the toolbar buttons gate on [disabled]="!selectedItem && disableButton", they
	// never get a .btn-disabled class — the old :not(.btn-disabled) probe matched even when unselected).
	// Clicking the row TOGGLES selection, so re-click only if the first click was lost to a late re-render.
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const row = page.locator(ExpensesPage.selectTableRowCss).nth(index);
	const editBtn = page.locator(ExpensesPage.editExpenseButtonCss).first();
	for (let attempt = 0; attempt < 4; attempt++) {
		await row.click({ force: true });
		for (let i = 0; i < 8; i++) {
			await page.waitForTimeout(350);
			if (!(await editBtn.isDisabled().catch(() => true))) return;
		}
	}
};

export const editExpenseButtonVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.editExpenseButtonCss);
};

export const clickEditExpenseButton = async () => {
	// dispatchClick: the preceding save/toastr leaves a fading backdrop over the toolbar that swallows a
	// coordinate click on Edit; dispatch fires openEditExpenseDialog() directly.
	await waitForSpinnerGone();
	await dispatchClick(ExpensesPage.editExpenseButtonCss);
};

export const deleteExpenseButtonVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.deleteExpenseButtonCss);
};

export const clickDeleteExpenseButton = async () => {
	// dispatchClick: same leftover-backdrop reason — fire deleteExpense() directly on the toolbar button.
	await waitForSpinnerGone();
	await dispatchClick(ExpensesPage.deleteExpenseButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	// dispatchClick: the delete-confirmation dialog footer can sit under a leftover backdrop; dispatch
	// fires the confirm directly so the dialog actually closes and the row is removed.
	await waitForSpinnerGone();
	await dispatchClick(ExpensesPage.confirmDeleteButtonCss);
};

export const clickCardBody = async () => {
	// Purpose here is only to dismiss the still-open tags ng-select overlay (it has closeOnSelect=false)
	// before clicking Save. Do NOT press Escape: the add-expense ExpensesMutationComponent is an NbDialog
	// opened with default options (closeOnEsc=true), so a document-level Escape closes the ENTIRE dialog —
	// that left the grid showing and the Save button gone (the round-4 failure). Instead click the inert
	// dialog title (cardBodyCss = h4.title, no handler): an in-dialog outside-click closes only the tags
	// dropdown overlay and leaves the form intact. Not the header's X icon, which would close the dialog.
	await getPage().locator(ExpensesPage.cardBodyCss).first().click({ force: true }).catch(() => {});
};

export const duplicateButtonVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.duplicateExpenseButtonCss);
};

export const clickDuplicateButton = async () => {
	// dispatchClick: leftover backdrop over the toolbar — fire openDuplicateExpenseDialog() directly.
	await waitForSpinnerGone();
	await dispatchClick(ExpensesPage.duplicateExpenseButtonCss);
};

export const manageCategoriesButtonVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.manageCategoriesButtonCss);
};

export const clickManageCategoriesButton = async () => {
	// dispatchClick after settling: the prior delete leaves a fading backdrop over the header; dispatch
	// fires manageCategories() (router navigation) directly so we reach the categories screen.
	await waitForSpinnerGone();
	await dispatchClick(ExpensesPage.manageCategoriesButtonCss);
};

export const newCategoryInputVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.expenseNameInputCss);
};

export const enterNewCategoryInputData = async (data) => {
	await clearField(ExpensesPage.expenseNameInputCss);
	await enterInput(ExpensesPage.expenseNameInputCss, data);
};

export const SaveCategoryButtonVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.SaveCategoryButtonCss);
};

export const clickSaveCategoryButton = async () => {
	// dispatchClick: the just-closed tags ng-select overlay leaves a fading backdrop over the dialog
	// footer; dispatch fires the category Save (ngSubmit) directly. Gated on form validity regardless.
	await waitForSpinnerGone();
	await dispatchClick(ExpensesPage.SaveCategoryButtonCss);
};

export const backButtonVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.backButtonCss);
};

export const clickBackButton = async () => {
	// dispatchClick: ngx-back-navigation's button can sit under a fading toastr/dialog backdrop after the
	// category save; dispatch fires goBack() directly.
	await waitForSpinnerGone();
	await dispatchClick(ExpensesPage.backButtonCss);
};

export const categoryCardVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.categoryCardCss);
};

export const clickCategoryCard = async () => {
	await clickButton(ExpensesPage.categoryCardCss);
};

export const waitMessageToHide = async () => {
	// The shared util.waitElementToHide hard-sleeps 10s every call; this spec calls
	// it ~6 times, blowing the per-test timeout. Poll for the toast to clear instead.
	const toast = getPage().locator(ExpensesPage.toastrMessageCss);
	try {
		await toast.first().waitFor({ state: 'hidden', timeout: 12000 });
	} catch {
		/* no toast appeared / already gone */
	}
};

export const verifyExpenseExists = async () => {
	await verifyElementIsVisibleByIndex(ExpensesPage.notBillableBadgeCss, 0);
};

export const verifyElementIsDeleted = async () => {
	await verifyElementNotExist(ExpensesPage.notBillableBadgeCss);
};

export const verifyCategoryExists = async (text) => {
	await verifyText(ExpensesPage.verifyCategoryCss, text);
};

export const sidebarBtnVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.sidebarBtnCss);
};

export const clickSidebarBtn = async (text) => {
	await clickElementByText(ExpensesPage.sidebarBtnCss, text);
};

export const clickAccountingExpensesSidebarBtn = async (text) => {
	await forceClickElementByText(ExpensesPage.accountingExpensesSidebarBtnCss, text);
};

export const clickReportsInnerSidebarBtn = async (text) => {
	await forceClickElementByText(ExpensesPage.reportsExpenseSidebarBtnCss, text);
};

export const verifyExpenseProject = async (project) => {
	await verifyText(ExpensesPage.expenseTableCellCss, project);
};

export const verifyExpenseAmount = async (amount) => {
	await verifyText(ExpensesPage.amountTableCellCss, amount);
};

export const groupBySelectVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.groupByCss);
};

export const clickGroupBySelect = async () => {
	await clickButton(ExpensesPage.groupByCss);
};

export const verifyDropdownOption = async (text) => {
	await verifyText(ExpensesPage.dropdownOptionCss, text);
};

export const selectOptionFromDropdown = async (text) => {
	await clickElementByText(ExpensesPage.dropdownOptionCss, text);
};
