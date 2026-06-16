import dayjs from 'dayjs';
import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	enterInputConditionally,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	waitElementToHide,
	verifyText,
	verifyElementNotExist
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { IncomePage } from '../../../src/support/Base/pageobjects/IncomePageObject';

export const gridBtnExists = async () => verifyElementIsVisible(IncomePage.gridButtonCss);

export const gridBtnClick = async (index: number) => clickButtonByIndex(IncomePage.gridButtonCss, index);

export const addIncomeButtonVisible = async () => verifyElementIsVisible(IncomePage.addIncomeButtonCss);

export const clickAddIncomeButton = async () => clickButton(IncomePage.addIncomeButtonCss);

export const selectEmployeeDropdownVisible = async () => verifyElementIsVisible(IncomePage.selectEmployeeDropdownCss);

export const clickEmployeeDropdown = async () => clickButton(IncomePage.selectEmployeeDropdownCss);

export const selectEmployeeFromDropdown = async (index: number) =>
	clickButtonByIndex(IncomePage.selectEmployeeDropdownOptionCss, index);

export const dateInputVisible = async () => verifyElementIsVisible(IncomePage.dateInputCss);

export const enterDateInputData = async () => {
	await clearField(IncomePage.dateInputCss);
	const date = dayjs().format('MMM D, YYYY');
	await enterInput(IncomePage.dateInputCss, date);
};

export const contactInputVisible = async () => verifyElementIsVisible(IncomePage.organizationContactCss);

export const clickContactInput = async () => clickButton(IncomePage.organizationContactCss);

export const enterContactInputData = async (data: string) =>
	enterInputConditionally(IncomePage.organizationContactCss, data);

export const amountInputVisible = async () => verifyElementIsVisible(IncomePage.amountInputCss);

export const enterAmountInputData = async (data: string) => {
	await clearField(IncomePage.amountInputCss);
	await enterInput(IncomePage.amountInputCss, data);
};

export const tagsDropdownVisible = async () => verifyElementIsVisible(IncomePage.addTagsDropdownCss);

export const clickTagsDropdown = async () => clickButton(IncomePage.addTagsDropdownCss);

export const selectTagFromDropdown = async (index: number) => clickButtonByIndex(IncomePage.tagsDropdownOption, index);

export const notesTextareaVisible = async () => verifyElementIsVisible(IncomePage.notesInputCss);

export const enterNotesInputData = async (data: string) => {
	await clearField(IncomePage.notesInputCss);
	await enterInput(IncomePage.notesInputCss, data);
};

export const saveIncomeButtonVisible = async () => verifyElementIsVisible(IncomePage.saveIncomeButtonCss);

export const clickSaveIncomeButton = async () => clickButton(IncomePage.saveIncomeButtonCss);

export const clickKeyboardButtonByKeyCode = async (keycode: number) => clickKeyboardBtnByKeycode(keycode);

export const tableRowVisible = async () => verifyElementIsVisible(IncomePage.selectTableRowCss);

export const selectTableRow = async (index: number) => clickButtonByIndex(IncomePage.selectTableRowCss, index);

export const editIncomeButtonVisible = async () => verifyElementIsVisible(IncomePage.editIncomeButtonCss);

export const clickEditIncomeButton = async () => clickButton(IncomePage.editIncomeButtonCss);

export const deleteIncomeButtonVisible = async () => verifyElementIsVisible(IncomePage.deleteIncomeButtonCss);

export const clickDeleteIncomeButton = async () => clickButton(IncomePage.deleteIncomeButtonCss);

export const confirmDeleteButtonVisible = async () => verifyElementIsVisible(IncomePage.confirmDeleteButtonCss);

export const clickConfirmDeleteButton = async () => clickButton(IncomePage.confirmDeleteButtonCss);

export const clickCardBody = async () => clickButton(IncomePage.cardBodyCss);

export const waitMessageToHide = async () => waitElementToHide(IncomePage.toastrMessageCss);

export const verifyElementIsDeleted = async () => verifyElementNotExist(IncomePage.verifyIncomeCss);

export const verifyIncomeExists = async (text: string) => verifyText(IncomePage.verifyIncomeCss, text);
