import {
	waitUntil,
	scopeGridTo,
	verifyElementIsVisible,
	clickButton,
	clickButtonByIndex,
	clearField,
	enterInput,
	waitElementToHide,
	verifyText,
	verifyTextNotExisting,
	verifyByText
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { OrganizationTagsPage } from '../../../src/support/Base/pageobjects/OrganizationTagsPageObject';

export const gridButtonVisible = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const clickGridButton = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addTagButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTagsPage.addTagButtonCss);
};

export const clickAddTagButton = async () => {
	await clickButton(OrganizationTagsPage.addTagButtonCss);
};

export const closeDialogButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTagsPage.closeDialogButtonCss);
};

export const clickCloseDialogButton = async () => {
	await clickButton(OrganizationTagsPage.closeDialogButtonCss);
};

export const tagNameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationTagsPage.tagNameInputCss);
};

export const enterTagNameData = async (data) => {
	await clearField(OrganizationTagsPage.tagNameInputCss);
	await enterInput(OrganizationTagsPage.tagNameInputCss, data);
};

export const tagColorInputVisible = async () => {
	await verifyElementIsVisible(OrganizationTagsPage.tagColorInputCss);
};

export const enterTagColorData = async (data) => {
	await clearField(OrganizationTagsPage.tagColorInputCss);
	await enterInput(OrganizationTagsPage.tagColorInputCss, data);
};

export const checkboxTenantLevelVisible = async () => {
	await verifyElementIsVisible(OrganizationTagsPage.tagTenantCheckboxCss);
};

export const clickCheckboxTenantLevel = async () => {
	await clickButton(OrganizationTagsPage.tagTenantCheckboxCss);
};

export const tagDescriptionTextareaVisible = async () => {
	await verifyElementIsVisible(OrganizationTagsPage.tagDescriptionCss);
};

export const enterTagDescriptionData = async (data) => {
	await clearField(OrganizationTagsPage.tagDescriptionCss);
	await enterInput(OrganizationTagsPage.tagDescriptionCss, data);
};

export const cancelAddTagButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTagsPage.cancelButtonCss);
};

export const clickCancelAddTagButton = async () => {
	await clickButton(OrganizationTagsPage.cancelButtonCss);
};

export const saveTagButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTagsPage.saveButtonCss);
};

export const clickSaveTagButton = async () => {
	await clickButton(OrganizationTagsPage.saveButtonCss);
};

export const tagsTableDataVisible = async () => {
	await verifyElementIsVisible(OrganizationTagsPage.selectTableRowCss);
};

export const selectTableRow = async (index) => {
	await clickButtonByIndex(OrganizationTagsPage.selectTableRowCss, index);
};

export const editTagButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTagsPage.editTagButtonCss);
};

export const clickEditTagButton = async () => {
	await clickButton(OrganizationTagsPage.editTagButtonCss);
};

export const deleteTagButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTagsPage.deleteTagButtonCss);
};

export const clickDeleteTagButton = async () => {
	await clickButton(OrganizationTagsPage.deleteTagButtonCss);
};

export const cancelDeleteTagButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTagsPage.cancelDeleteTagButtonCss);
};

export const clickCancelDeleteTagButton = async () => {
	await clickButton(OrganizationTagsPage.cancelDeleteTagButtonCss);
};

export const confirmDeleteTagButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTagsPage.confirmDeleteTagButtonCss);
};

export const clickConfirmDeleteTagButton = async () => {
	await clickButton(OrganizationTagsPage.confirmDeleteTagButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(OrganizationTagsPage.toastrMessageCss);
};

export const verifyTagExists = async (text) => {
	// Scope the grid to THIS tag before asserting. The tags grid is server-paginated at 10 rows, the
	// seed already ships a full page of tags and the serial suite keeps adding more, so a freshly
	// created tag routinely sits on page 2 and the unfiltered assertion failed even though the record
	// existed — a textbook order-dependent failure.
	//
	// Filtering also makes the FOLLOWING step correct: the steps do `selectTableRow(0)` straight after
	// this, and on an unfiltered grid row 0 is whatever the API happened to sort first — so the spec
	// would edit/delete a seeded tag instead of its own.
	await scopeGridTo(OrganizationTagsPage.filterNameInputCss, text);
	await verifyText(OrganizationTagsPage.verifyTagCss, text);
};

export const verifyTagIsDeleted = async (text) => {
	// Same scoping: assert the absence against the FILTERED grid, so this cannot be satisfied merely by
	// the row having moved to another page.
	await scopeGridTo(OrganizationTagsPage.filterNameInputCss, text);
	await verifyTextNotExisting(OrganizationTagsPage.verifyTagCss, text);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationTagsPage.filterNameInputCss);
};

export const enterFilterInputData = async (text) => {
	// applySmartTableFilter, NOT enterInput: the grid's filter cell is
	// `<input [value]="query" (change) (keyup)>` and never listens for 'input', which is the only event
	// Playwright's .fill() dispatches — so the old call typed into the box and filtered nothing.
	await scopeGridTo(OrganizationTagsPage.filterNameInputCss, text);
};

export const filteredTagVisible = async (text) => {
	await verifyByText(OrganizationTagsPage.firstTableCellTagCss, text);
};

export const clearFilterInputField = async () => {
	await clearField(OrganizationTagsPage.filterNameInputCss);
	await waitUntil(1000);
};
