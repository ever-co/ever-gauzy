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
} from '../utils/util';
import { OrganizationInventoryPage } from '../pageobjects/OrganizationInventoryPageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(OrganizationInventoryPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(OrganizationInventoryPage.gridButtonCss, index);
};

export const addCategoryOrTypeButtonVisible = () => {
	verifyElementIsVisible(
		OrganizationInventoryPage.addCategoryOrTypeButtonCss
	);
};

export const clickAddCategoryOrTypeButton = (text) => {
	clickButtonByText(text);
};

export const addButtonVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.addButtonCss);
};

export const clickAddButton = () => {
	clickButton(OrganizationInventoryPage.addButtonCss);
};

export const languageDropdownVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.languageDropdownCss);
};

export const clickLangaugeDropdown = () => {
	clickButton(OrganizationInventoryPage.languageDropdownCss);
};

export const productTypeDropdownVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.productTypeDropdownCss);
};

export const clickProductTypeDrodpwon = () => {
	clickButton(OrganizationInventoryPage.productTypeDropdownCss);
};

export const productCategoryDropdownVisible = () => {
	verifyElementIsVisible(
		OrganizationInventoryPage.productCategoryDropdownCss
	);
};

export const clickProductCategoryDrodpwon = () => {
	clickButton(OrganizationInventoryPage.productCategoryDropdownCss);
};

export const clickDropdownOption = (index) => {
	clickButtonByIndex(OrganizationInventoryPage.dropdownOptionCss, index);
};

export const nameInputVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.nameInputCss);
};

export const enterNameInputData = (data) => {
	clearField(OrganizationInventoryPage.nameInputCss);
	enterInput(OrganizationInventoryPage.nameInputCss, data);
};

export const codeInputVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.codeInputCss);
};

export const enterCodeInputData = (data) => {
	clearField(OrganizationInventoryPage.codeInputCss);
	enterInput(OrganizationInventoryPage.codeInputCss, data);
};

export const descriptionInputVisivle = () => {
	verifyElementIsVisible(OrganizationInventoryPage.descriptionInputCss);
};

export const enterDescriptionInputData = (data) => {
	clearField(OrganizationInventoryPage.descriptionInputCss);
	enterInput(OrganizationInventoryPage.descriptionInputCss, data);
};

export const backButtonVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.backButtonCss);
};

export const clickBackButton = () => {
	clickButton(OrganizationInventoryPage.backButtonCss);
};

export const backFromCategoryButtonVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.backFromCategoryButtonCss);
};

export const clickBackFromCategodyButton = () => {
	clickButton(OrganizationInventoryPage.backFromCategoryButtonCss);
};

export const backFromInventoryButtonVisible = () => {
	verifyElementIsVisible(
		OrganizationInventoryPage.backFromInventoryButtonCss
	);
};

export const clickBackFromInventoryButton = () => {
	clickButton(OrganizationInventoryPage.backFromInventoryButtonCss);
};

export const saveButtonVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.saveButtonCss);
};

export const clickSaveButton = () => {
	clickButton(OrganizationInventoryPage.saveButtonCss);
};

export const editButtonVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.editButtonCss);
};

export const clickEditButton = () => {
	clickButton(OrganizationInventoryPage.editButtonCss);
};

export const deleteButtonVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.deleteButtonCss);
};

export const clickDeleteButton = () => {
	clickButton(OrganizationInventoryPage.deleteButtonCss);
};

export const tableRowVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.selectTableRowCss);
};

export const selectTableRow = (index) => {
	clickButtonByIndex(OrganizationInventoryPage.selectTableRowCss, index);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = () => {
	clickButton(OrganizationInventoryPage.confirmDeleteButtonCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(OrganizationInventoryPage.toastrMessageCss);
};

export const verifyTypeExists = (text) => {
	verifyText(OrganizationInventoryPage.verifyTypeCss, text);
};

export const verifyTypeIsDeleted = (text) => {
	verifyTextNotExisting(OrganizationInventoryPage.verifyTypeCss, text);
};

export const verifyCategorieExists = (text) => {
	verifyText(OrganizationInventoryPage.verifyCategorieCss, text);
};

export const verifyCategorieIsDeleted = (text) => {
	verifyTextNotExisting(OrganizationInventoryPage.verifyCategorieCss, text);
};

export const verifyInventoryExists = (text) => {
	verifyText(OrganizationInventoryPage.verifyInventoryCss, text);
};

export const verifyInventoryIsDeleted = () => {
	verifyElementNotExist(OrganizationInventoryPage.verifyInventoryCss);
};

export const merchantOrWarehouseBtnVisible = () => {
	verifyElementIsVisible(
		OrganizationInventoryPage.merchantsOrWarehousesBtnCss
	);
};

export const clickMerchantOrWarehouseBtn = (text) => {
	clickElementByText(
		OrganizationInventoryPage.merchantsOrWarehousesBtnCss,
		text
	);
};

export const addMerchantBtnVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.addMerchantBtnCss);
};

export const clickAddMerchantBtn = () => {
	clickButton(OrganizationInventoryPage.addMerchantBtnCss);
};

export const merchantNameInputVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.merchantNameInputCss);
};

export const enterMerchantNameInput = (name) => {
	clearField(OrganizationInventoryPage.merchantNameInputCss);
	enterInput(OrganizationInventoryPage.merchantNameInputCss, name);
};

export const merchantCodeInputVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.merchantCodeInputCss);
};

export const enterMerchantCode = (code) => {
	clearField(OrganizationInventoryPage.merchantCodeInputCss);
	enterInput(OrganizationInventoryPage.merchantCodeInputCss, code);
};

export const merchantEmailInputVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.merchantEmailInputCss);
};

export const enterMerchantEmail = (email) => {
	clearField(OrganizationInventoryPage.merchantEmailInputCss);
	enterInput(OrganizationInventoryPage.merchantEmailInputCss, email);
};

export const merchantPhoneInputVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.merchantPhoneInputCss);
};

export const enterMerchantPhone = (phone) => {
	clearField(OrganizationInventoryPage.merchantPhoneInputCss);
	enterInput(OrganizationInventoryPage.merchantPhoneInputCss, phone);
};

export const merchantCurrencySelectVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.merchantCurrencySelectCss);
};

export const clickMerchantCurrencySelect = () => {
	clickButton(OrganizationInventoryPage.merchantCurrencySelectCss);
};

export const currencyDropdownOptionVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.dropdownOptionCss);
};

export const selectCurrencyFromDropdownOptions = (currency) => {
	clickElementByText(OrganizationInventoryPage.dropdownOptionCss, currency);
};

export const merchantWebsiteInputVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.merchantWebsiteInputCss);
};

export const enterMerchantWebsite = (website) => {
	clearField(OrganizationInventoryPage.merchantWebsiteInputCss);
	enterInput(OrganizationInventoryPage.merchantWebsiteInputCss, website);
};

export const tagsSelectVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.tagsSelectCss);
};

export const clickTagsSelect = () => {
	clickButton(OrganizationInventoryPage.tagsSelectCss);
};

export const selectTagFromDropdownOptions = (index) => {
	clickButtonByIndex(OrganizationInventoryPage.tagsDropdownOptionCss, index);
};

export const merchantDescriptionInputVisible = () => {
	verifyElementIsVisible(
		OrganizationInventoryPage.merchantDescriptionInputCss
	);
};

export const enterMerchantDescription = (description) => {
	clearField(OrganizationInventoryPage.merchantDescriptionInputCss);
	enterInput(
		OrganizationInventoryPage.merchantDescriptionInputCss,
		description
	);
};

export const activeStateCheckBoxVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.merchantActiveCheckboxCss);
};

export const clickActiveStateCheckbox = () => {
	clickButton(OrganizationInventoryPage.merchantActiveCheckboxCss);
};

export const merchantNextBtnVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.merchantNextBtnCss);
};

export const clickMerchantNextBtn = (text) => {
	clickElementByText(OrganizationInventoryPage.merchantNextBtnCss, text);
};

export const countrySelectVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.countrySelectCss);
};

export const clickCountrySelect = () => {
	clickButton(OrganizationInventoryPage.countrySelectCss);
};

export const selectCountryFromDropdownOptions = (country) => {
	clickElementByText(OrganizationInventoryPage.dropdownOptionCss, country);
};

export const cityInputVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.cityInputCss);
};

export const enterCity = (city) => {
	clearField(OrganizationInventoryPage.cityInputCss);
	enterInput(OrganizationInventoryPage.cityInputCss, city);
};

export const postcodeInputVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.postcodeInputCss);
};

export const enterPostcode = (postcode) => {
	clearField(OrganizationInventoryPage.postcodeInputCss);
	enterInput(OrganizationInventoryPage.postcodeInputCss, postcode);
};

export const addressInputVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.addressInputCss);
};

export const enterAddress = (address) => {
	clearField(OrganizationInventoryPage.addressInputCss);
	enterInput(OrganizationInventoryPage.addressInputCss, address);
};

export const warehousesSelectVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.warehousesSelectCss);
};

export const clickWarehousesSelect = () => {
	clickButton(OrganizationInventoryPage.warehousesSelectCss);
};

export const saveMerchantBtnVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.saveMerchantBtnCss);
};

export const clickSaveMerchantBtn = () => {
	clickButton(OrganizationInventoryPage.saveMerchantBtnCss);
};

export const editMerchantBtnVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.editMerchantBtnCss);
};

export const clickEditMerchantBtn = () => {
	clickButton(OrganizationInventoryPage.editMerchantBtnCss);
};

export const deleteMerchantBtnVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.deleteMerchantBtnCss);
};

export const clickDeleteMerchantBtn = () => {
	clickButton(OrganizationInventoryPage.deleteMerchantBtnCss);
};

export const addWarehouseBtnVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.addWarehouseBtnCss);
};

export const clickAddWarehouseBtn = () => {
	clickButton(OrganizationInventoryPage.addWarehouseBtnCss);
};

export const warehouseNameInputVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.warehouseNameInputCss);
};

export const enterWarehouseName = (name) => {
	clearField(OrganizationInventoryPage.warehouseNameInputCss);
	enterInput(OrganizationInventoryPage.warehouseNameInputCss, name);
};

export const warehouseCodeInputVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.warehouseCodeInputCss);
};

export const enterWarehouseCode = (code) => {
	clearField(OrganizationInventoryPage.warehouseCodeInputCss);
	enterInput(OrganizationInventoryPage.warehouseCodeInputCss, code);
};

export const warehouseEmailInputVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.warehouseEmailInputCss);
};

export const enterWarehouseEmail = (email) => {
	clearField(OrganizationInventoryPage.warehouseEmailInputCss);
	enterInput(OrganizationInventoryPage.warehouseEmailInputCss, email);
};

export const warehouseDescriptionInputVisible = () => {
	verifyElementIsVisible(
		OrganizationInventoryPage.warehouseDescriptionInputCss
	);
};

export const enterWarehouseDescription = (description) => {
	clearField(OrganizationInventoryPage.warehouseDescriptionInputCss);
	enterInput(
		OrganizationInventoryPage.warehouseDescriptionInputCss,
		description
	);
};

export const tabBtnVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.tabBtnCss);
};

export const clickTabBtn = (text) => {
	clickElementByText(OrganizationInventoryPage.tabBtnCss, text);
};

export const saveWarehouseBtnVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.saveWarehouseBtnCss);
};

export const clickSaveWarehouseBtn = () => {
	clickButton(OrganizationInventoryPage.saveWarehouseBtnCss);
};

export const editWarehouseBtnVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.editWarehouseBtnCss);
};

export const clickEditWarehouseBtn = () => {
	clickButton(OrganizationInventoryPage.editWarehouseBtnCss);
};

export const deleteWarehouseBtnVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.deleteWarehouseBtnCss);
};

export const clickDeleteWarehouseBtn = () => {
	clickButton(OrganizationInventoryPage.deleteWarehouseBtnCss);
};

export const sidebarBtnVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.sidebarBtnCss);
};

export const clickSidebarBtn = (text) => {
	clickElementByText(OrganizationInventoryPage.sidebarBtnCss, text);
};

export const verifyMerchantWarehouse = (text) => {
	verifyText(OrganizationInventoryPage.verifyMerchantWarehouseCss, text);
};

export const clickInventorySidebarBtn = () => {
	clickButton(OrganizationInventoryPage.inventorySidebarBtnCss);
};
