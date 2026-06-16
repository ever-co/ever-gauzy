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
	verifyText,
	verifyElementIsNotVisible
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { InvoicesPage } from '../../../src/support/Base/pageobjects/InvoicesPageObject';

export const gridBtnExists = async () => verifyElementIsVisible(InvoicesPage.gridButtonCss);

export const gridBtnClick = async (index: number) => clickButtonByIndex(InvoicesPage.gridButtonCss, index);

export const addButtonVisible = async () => verifyElementIsVisible(InvoicesPage.addButtonCss);

export const clickAddButton = async () => clickButton(InvoicesPage.addButtonCss);

export const tagsDropdownVisible = async () => verifyElementIsVisible(InvoicesPage.addTagsDropdownCss);

export const clickTagsDropdown = async () => clickButton(InvoicesPage.addTagsDropdownCss);

export const selectTagFromDropdown = async (index: number) => clickButtonByIndex(InvoicesPage.tagsDropdownOption, index);

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

export const clickContactDropdown = async () => clickButton(InvoicesPage.organizationContactDropdownCss);

export const selectContactFromDropdown = async (index: number) =>
	clickButtonByIndex(InvoicesPage.contactOptionCss, index);

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

export const clickGenerateItemsButton = async () => clickButton(InvoicesPage.generateItemsButtonCss);

export const saveAsDraftButtonVisible = async () => verifyElementIsVisible(InvoicesPage.saveAsDraftButtonCss);

export const clickSaveAsDraftButton = async (text: string) => clickButtonByText(text);

export const tableRowVisible = async () => verifyElementIsVisible(InvoicesPage.tableRowCss);

export const selectTableRow = async (index: number) => clickButtonByIndex(InvoicesPage.tableRowCss, index);

export const actionButtonVisible = async () => verifyElementIsVisible(InvoicesPage.popoverButtonCss);

export const clickActionButtonByText = async (text: string) => clickElementByText(InvoicesPage.popoverButtonCss, text);

export const backButtonVisible = async () => verifyElementIsVisible(InvoicesPage.backButtonCss);

export const clickBackButton = async () => clickButton(InvoicesPage.backButtonCss);

export const confirmButtonVisible = async () => verifyElementIsVisible(InvoicesPage.confirmButtonCss);

export const clickConfirmButton = async () => clickButton(InvoicesPage.confirmButtonCss);

export const emailInputVisible = async () => verifyElementIsVisible(InvoicesPage.emailInputCss);

export const enterEmailData = async (data: string) => enterInput(InvoicesPage.emailInputCss, data);

export const editButtonVisible = async () => verifyElementIsVisible(InvoicesPage.editButtonCss);

export const clickEditButton = async (index: number) => clickButtonByIndex(InvoicesPage.editButtonCss, index);

export const viewButtonVisible = async () => verifyElementIsVisible(InvoicesPage.viewButtonCss);

export const clickViewButton = async (index: number) => clickButtonByIndex(InvoicesPage.viewButtonCss, index);

export const deleteButtonVisible = async () => verifyElementIsVisible(InvoicesPage.deleteButtonCss);

export const clickDeleteButton = async () => clickButton(InvoicesPage.deleteButtonCss);

export const confirmDeleteButtonVisible = async () => verifyElementIsVisible(InvoicesPage.confirmDeleteButtonCss);

export const clickConfirmDeleteButton = async () => clickButton(InvoicesPage.confirmDeleteButtonCss);

export const setStatusButtonVisible = async () => verifyElementIsVisible(InvoicesPage.setStatusButtonCss);

export const clickSetStatusButton = async (text: string) => clickElementByText(InvoicesPage.setStatusButtonCss, text);

export const setStatusFromDropdown = async (text: string) => clickElementByText(InvoicesPage.dropdownOptionCss, text);

export const verifyEstimateExists = async (val: string) => verifyValue(InvoicesPage.verifyInvoiceCss, val);

export const verifyDraftBadgeClass = async () => verifyElementIsVisible(InvoicesPage.draftBadgeCss);

export const verifySentBadgeClass = async () => verifyElementIsVisible(InvoicesPage.successBadgeCss);

export const verifyElementIsDeleted = async (text: string) => verifyText(InvoicesPage.verifyInvoiceCss, text);

export const scrollEmailInviteTemplate = async () => scrollDown(InvoicesPage.emailCardCss);

export const moreButtonVisible = async () => verifyElementIsVisible(InvoicesPage.moreButtonCss);

export const clickMoreButton = async () => clickButton(InvoicesPage.moreButtonCss);

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
