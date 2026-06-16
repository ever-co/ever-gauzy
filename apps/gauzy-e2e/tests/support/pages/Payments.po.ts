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
	forceClickElementByText
} from '../util';
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
	await clickButtonByIndex(PaymentsPage.addTagsDropdownCss, index);
};

export const selectTagFromDropdown = async (index: number) => {
	await clickButtonByIndex(PaymentsPage.tagsDropdownOption, index);
};

export const projectDropdownVisible = async () => {
	await verifyElementIsVisible(PaymentsPage.projectDropdownCss);
};

export const clickProjectDropdown = async () => {
	await clickButton(PaymentsPage.projectDropdownCss);
};

export const selectProjectFromDropdown = async (text: string) => {
	await clickElementByText(PaymentsPage.projectDropdownOptionCss, text);
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
	await clickButton(PaymentsPage.saveExpenseButtonCss);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(PaymentsPage.selectTableRowCss);
};

export const selectTableRow = async (index: number) => {
	await clickButtonByIndex(PaymentsPage.selectTableRowCss, index);
};

export const editPaymentButtonVisible = async () => {
	await verifyElementIsVisible(PaymentsPage.editPaymentButtonCss);
};

export const clickEditPaymentButton = async () => {
	await clickButton(PaymentsPage.editPaymentButtonCss);
};

export const deletePaymentButtonVisible = async () => {
	await verifyElementIsVisible(PaymentsPage.deletePaymentButtonCss);
};

export const clickDeletePaymentButton = async () => {
	await clickButton(PaymentsPage.deletePaymentButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(PaymentsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(PaymentsPage.confirmDeleteButtonCss);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const clickCardBody = async () => {
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
