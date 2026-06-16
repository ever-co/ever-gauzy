import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickButtonByIndex,
	waitElementToHide,
	clickButtonByText,
	verifyText,
	verifyTextNotExisting,
	verifyElementNotExist,
	clickElementByText
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { OrganizationInventoryPage } from '../../../src/support/Base/pageobjects/OrganizationInventoryPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addCategoryOrTypeButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.addCategoryOrTypeButtonCss);
};

export const clickAddCategoryOrTypeButton = async (text) => {
	await clickButtonByText(text);
};

export const addButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.addButtonCss);
};

export const clickAddButton = async () => {
	await clickButton(OrganizationInventoryPage.addButtonCss);
};

export const languageDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.languageDropdownCss);
};

export const clickLanguageDropdown = async () => {
	await clickButton(OrganizationInventoryPage.languageDropdownCss);
};

export const productTypeDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.productTypeDropdownCss);
};

export const clickProductTypeDropdown = async () => {
	await clickButton(OrganizationInventoryPage.productTypeDropdownCss);
};

export const productCategoryDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.productCategoryDropdownCss);
};

export const clickProductCategoryDropdown = async () => {
	await clickButton(OrganizationInventoryPage.productCategoryDropdownCss);
};

export const clickDropdownOption = async (index) => {
	await clickButtonByIndex(OrganizationInventoryPage.dropdownOptionCss, index);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.nameInputCss);
};

export const enterNameInputData = async (data) => {
	await clearField(OrganizationInventoryPage.nameInputCss);
	await enterInput(OrganizationInventoryPage.nameInputCss, data);
};

export const codeInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.codeInputCss);
};

export const enterCodeInputData = async (data) => {
	await clearField(OrganizationInventoryPage.codeInputCss);
	await enterInput(OrganizationInventoryPage.codeInputCss, data);
};

export const descriptionInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.descriptionInputCss);
};

export const enterDescriptionInputData = async (data) => {
	await clearField(OrganizationInventoryPage.descriptionInputCss);
	await enterInput(OrganizationInventoryPage.descriptionInputCss, data);
};

export const backButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.backButtonCss);
};

export const clickBackButton = async () => {
	await clickButton(OrganizationInventoryPage.backButtonCss);
};

export const backFromCategoryButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.backFromCategoryButtonCss);
};

export const clickBackFromCategoryButton = async () => {
	await clickButton(OrganizationInventoryPage.backFromCategoryButtonCss);
};

export const backFromInventoryButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.backFromInventoryButtonCss);
};

export const clickBackFromInventoryButton = async () => {
	await clickButton(OrganizationInventoryPage.backFromInventoryButtonCss);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	await clickButton(OrganizationInventoryPage.saveButtonCss);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.editButtonCss);
};

export const clickEditButton = async () => {
	await clickButton(OrganizationInventoryPage.editButtonCss);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.deleteButtonCss);
};

export const clickDeleteButton = async () => {
	await clickButton(OrganizationInventoryPage.deleteButtonCss);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.selectTableRowCss);
};

export const selectTableRow = async (index) => {
	await clickButtonByIndex(OrganizationInventoryPage.selectTableRowCss, index);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(OrganizationInventoryPage.confirmDeleteButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(OrganizationInventoryPage.toastrMessageCss);
};

export const verifyTypeExists = async (text) => {
	await verifyText(OrganizationInventoryPage.verifyTypeCss, text);
};

export const verifyTypeIsDeleted = async (text) => {
	await verifyTextNotExisting(OrganizationInventoryPage.verifyTypeCss, text);
};

export const verifyCategoryExists = async (text) => {
	await verifyText(OrganizationInventoryPage.verifyCategoryCss, text);
};

export const verifyCategoryIsDeleted = async (text) => {
	await verifyTextNotExisting(OrganizationInventoryPage.verifyCategoryCss, text);
};

export const verifyInventoryExists = async (text) => {
	await verifyText(OrganizationInventoryPage.verifyInventoryCss, text);
};

export const verifyInventoryIsDeleted = async () => {
	await verifyElementNotExist(OrganizationInventoryPage.verifyInventoryCss);
};

export const merchantOrWarehouseBtnVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.merchantsOrWarehousesBtnCss);
};

export const clickMerchantOrWarehouseBtn = async (text) => {
	await clickElementByText(OrganizationInventoryPage.merchantsOrWarehousesBtnCss, text);
};

export const addMerchantBtnVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.addMerchantBtnCss);
};

export const clickAddMerchantBtn = async () => {
	await clickButton(OrganizationInventoryPage.addMerchantBtnCss);
};

export const merchantNameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.merchantNameInputCss);
};

export const enterMerchantNameInput = async (name) => {
	await clearField(OrganizationInventoryPage.merchantNameInputCss);
	await enterInput(OrganizationInventoryPage.merchantNameInputCss, name);
};

export const merchantCodeInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.merchantCodeInputCss);
};

export const enterMerchantCode = async (code) => {
	await clearField(OrganizationInventoryPage.merchantCodeInputCss);
	await enterInput(OrganizationInventoryPage.merchantCodeInputCss, code);
};

export const merchantEmailInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.merchantEmailInputCss);
};

export const enterMerchantEmail = async (email) => {
	await clearField(OrganizationInventoryPage.merchantEmailInputCss);
	await enterInput(OrganizationInventoryPage.merchantEmailInputCss, email);
};

export const merchantPhoneInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.merchantPhoneInputCss);
};

export const enterMerchantPhone = async (phone) => {
	await clearField(OrganizationInventoryPage.merchantPhoneInputCss);
	await enterInput(OrganizationInventoryPage.merchantPhoneInputCss, phone);
};

export const merchantCurrencySelectVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.merchantCurrencySelectCss);
};

export const clickMerchantCurrencySelect = async () => {
	await clickButton(OrganizationInventoryPage.merchantCurrencySelectCss);
};

export const currencyDropdownOptionVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.dropdownOptionCss);
};

export const selectCurrencyFromDropdownOptions = async (currency) => {
	await clickElementByText(OrganizationInventoryPage.dropdownOptionCss, currency);
};

export const merchantWebsiteInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.merchantWebsiteInputCss);
};

export const enterMerchantWebsite = async (website) => {
	await clearField(OrganizationInventoryPage.merchantWebsiteInputCss);
	await enterInput(OrganizationInventoryPage.merchantWebsiteInputCss, website);
};

export const tagsSelectVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.tagsSelectCss);
};

export const clickTagsSelect = async () => {
	await clickButton(OrganizationInventoryPage.tagsSelectCss);
};

export const selectTagFromDropdownOptions = async (index) => {
	await clickButtonByIndex(OrganizationInventoryPage.tagsDropdownOptionCss, index);
};

export const merchantDescriptionInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.merchantDescriptionInputCss);
};

export const enterMerchantDescription = async (description) => {
	await clearField(OrganizationInventoryPage.merchantDescriptionInputCss);
	await enterInput(OrganizationInventoryPage.merchantDescriptionInputCss, description);
};

export const activeStateCheckBoxVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.merchantActiveCheckboxCss);
};

export const clickActiveStateCheckbox = async () => {
	await clickButton(OrganizationInventoryPage.merchantActiveCheckboxCss);
};

export const merchantNextBtnVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.merchantNextBtnCss);
};

export const clickMerchantNextBtn = async (text) => {
	await clickElementByText(OrganizationInventoryPage.merchantNextBtnCss, text);
};

export const countrySelectVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.countrySelectCss);
};

export const clickCountrySelect = async () => {
	await clickButton(OrganizationInventoryPage.countrySelectCss);
};

export const selectCountryFromDropdownOptions = async (country) => {
	await clickElementByText(OrganizationInventoryPage.dropdownOptionCss, country);
};

export const cityInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.cityInputCss);
};

export const enterCity = async (city) => {
	await clearField(OrganizationInventoryPage.cityInputCss);
	await enterInput(OrganizationInventoryPage.cityInputCss, city);
};

export const postcodeInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.postCodeInputCss);
};

export const enterPostcode = async (postcode) => {
	await clearField(OrganizationInventoryPage.postCodeInputCss);
	await enterInput(OrganizationInventoryPage.postCodeInputCss, postcode);
};

export const addressInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.addressInputCss);
};

export const enterAddress = async (address) => {
	await clearField(OrganizationInventoryPage.addressInputCss);
	await enterInput(OrganizationInventoryPage.addressInputCss, address);
};

export const warehousesSelectVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.warehousesSelectCss);
};

export const clickWarehousesSelect = async () => {
	await clickButton(OrganizationInventoryPage.warehousesSelectCss);
};

export const saveMerchantBtnVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.saveMerchantBtnCss);
};

export const clickSaveMerchantBtn = async () => {
	await clickButton(OrganizationInventoryPage.saveMerchantBtnCss);
};

export const editMerchantBtnVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.editMerchantBtnCss);
};

export const clickEditMerchantBtn = async () => {
	await clickButton(OrganizationInventoryPage.editMerchantBtnCss);
};

export const deleteMerchantBtnVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.deleteMerchantBtnCss);
};

export const clickDeleteMerchantBtn = async () => {
	await clickButton(OrganizationInventoryPage.deleteMerchantBtnCss);
};

export const addWarehouseBtnVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.addWarehouseBtnCss);
};

export const clickAddWarehouseBtn = async () => {
	await clickButton(OrganizationInventoryPage.addWarehouseBtnCss);
};

export const warehouseNameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.warehouseNameInputCss);
};

export const enterWarehouseName = async (name) => {
	await clearField(OrganizationInventoryPage.warehouseNameInputCss);
	await enterInput(OrganizationInventoryPage.warehouseNameInputCss, name);
};

export const warehouseCodeInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.warehouseCodeInputCss);
};

export const enterWarehouseCode = async (code) => {
	await clearField(OrganizationInventoryPage.warehouseCodeInputCss);
	await enterInput(OrganizationInventoryPage.warehouseCodeInputCss, code);
};

export const warehouseEmailInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.warehouseEmailInputCss);
};

export const enterWarehouseEmail = async (email) => {
	await clearField(OrganizationInventoryPage.warehouseEmailInputCss);
	await enterInput(OrganizationInventoryPage.warehouseEmailInputCss, email);
};

export const warehouseDescriptionInputVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.warehouseDescriptionInputCss);
};

export const enterWarehouseDescription = async (description) => {
	await clearField(OrganizationInventoryPage.warehouseDescriptionInputCss);
	await enterInput(OrganizationInventoryPage.warehouseDescriptionInputCss, description);
};

export const tabBtnVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.tabBtnCss);
};

export const clickTabBtn = async (text) => {
	await clickElementByText(OrganizationInventoryPage.tabBtnCss, text);
};

export const saveWarehouseBtnVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.saveWarehouseBtnCss);
};

export const clickSaveWarehouseBtn = async () => {
	await clickButton(OrganizationInventoryPage.saveWarehouseBtnCss);
};

export const editWarehouseBtnVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.editWarehouseBtnCss);
};

export const clickEditWarehouseBtn = async () => {
	await clickButton(OrganizationInventoryPage.editWarehouseBtnCss);
};

export const deleteWarehouseBtnVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.deleteWarehouseBtnCss);
};

export const clickDeleteWarehouseBtn = async () => {
	await clickButton(OrganizationInventoryPage.deleteWarehouseBtnCss);
};

export const sidebarBtnVisible = async () => {
	await verifyElementIsVisible(OrganizationInventoryPage.sidebarBtnCss);
};

export const clickSidebarBtn = async (text) => {
	await clickElementByText(OrganizationInventoryPage.sidebarBtnCss, text);
};

export const verifyMerchantWarehouse = async (text) => {
	await verifyText(OrganizationInventoryPage.verifyMerchantWarehouseCss, text);
};

export const clickInventorySidebarBtn = async () => {
	await clickButton(OrganizationInventoryPage.inventorySidebarBtnCss);
};
