import {
	verifyElementIsVisible,
	clickButtonByIndex,
	clickButton,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	verifyTextNotExisting,
	getLastElement,
	waitElementToHide,
	verifyValue,
	wait
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { AddEmployeePositionPage } from '../../../src/support/Base/pageobjects/AddEmployeePositionPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addNewPositionButtonVisible = async () => {
	await verifyElementIsVisible(AddEmployeePositionPage.addNewPositionButtonCss);
};

export const clickAddNewPositionButton = async () => {
	await clickButton(AddEmployeePositionPage.addNewPositionButtonCss);
};

export const cancelNewPositionButtonVisible = async () => {
	await verifyElementIsVisible(AddEmployeePositionPage.cancelNewPositionButtonCss);
};

export const clickCancelNewPositionButton = async () => {
	await clickButton(AddEmployeePositionPage.cancelNewPositionButtonCss);
};

export const newPositionInputVisible = async () => {
	await verifyElementIsVisible(AddEmployeePositionPage.newPositionInputCss);
};

export const enterNewPositionData = async (data: string) => {
	await clickButton(AddEmployeePositionPage.newPositionInputCss);
	await enterInput(AddEmployeePositionPage.newPositionInputCss, data);
};

export const tagsMultiSelectVisible = async () => {
	await verifyElementIsVisible(AddEmployeePositionPage.tagsSelectCss);
};

export const clickTagsMultiSelect = async () => {
	await clickButton(AddEmployeePositionPage.tagsSelectCss);
};

export const selectTagsFromDropdown = async (index: number) => {
	await clickButtonByIndex(AddEmployeePositionPage.tagsSelectOptionCss, index);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const savePositionButtonVisible = async () => {
	await verifyElementIsVisible(AddEmployeePositionPage.saveNewPositionButtonCss);
};

export const clickSavePositionButton = async () => {
	await clickButton(AddEmployeePositionPage.saveNewPositionButtonCss);
};

export const updatePositionButtonVisible = async () => {
	await verifyElementIsVisible(AddEmployeePositionPage.updatePositionButtonCss);
};

export const clickUpdatePositionButton = async () => {
	await clickButton(AddEmployeePositionPage.updatePositionButtonCss);
};

export const editEmployeePositionButtonVisible = async () => {
	await verifyElementIsVisible(
		AddEmployeePositionPage.editEmployeePositionButtonCss
	);
};

export const clickEditEmployeePositionButton = async () => {
	await clickButton(AddEmployeePositionPage.editEmployeePositionButtonCss);
};

export const selectPositionToEdit = async () => {
	await getLastElement(AddEmployeePositionPage.selectPositionToEditCss);
};

export const selectPositionToDelete = async () => {
	await getLastElement(AddEmployeePositionPage.selectPositionToDeleteCss);
};

export const clickRowEmployeeLevelTwice = async () => {
	await wait(500);
	await getLastElement(AddEmployeePositionPage.selectPositionToEditCss);
};

export const editEmployeePositionInputVisible = async () => {
	await verifyElementIsVisible(AddEmployeePositionPage.editPositionInputCss);
};

export const enterEditPositionData = async (data: string) => {
	await clearField(AddEmployeePositionPage.editPositionInputCss);
	await enterInput(AddEmployeePositionPage.editPositionInputCss, data);
};

export const deletePositionButtonVisible = async () => {
	await verifyElementIsVisible(
		AddEmployeePositionPage.removeEmployeePositionButtonCss
	);
};

export const clickDeletePositionButton = async () => {
	await getLastElement(AddEmployeePositionPage.removeEmployeePositionButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(
		AddEmployeePositionPage.confirmDeletePositionButtonCss
	);
};

export const clickConfirmDeletePositionButton = async () => {
	await clickButton(AddEmployeePositionPage.confirmDeletePositionButtonCss);
};

export const verifyTitleExists = async (text: string) => {
	await verifyValue(AddEmployeePositionPage.editPositionInputCss, text);
};

export const verifyElementIsDeleted = async (text: string) => {
	await verifyTextNotExisting(AddEmployeePositionPage.verifyTextCss, text);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(AddEmployeePositionPage.toastrMessageCss);
};

export const cancelButtonVisible = async () => {
	await verifyElementIsVisible(AddEmployeePositionPage.cancelButtonCss);
};

export const clickCancelButton = async () => {
	await clickButton(AddEmployeePositionPage.cancelButtonCss);
};
