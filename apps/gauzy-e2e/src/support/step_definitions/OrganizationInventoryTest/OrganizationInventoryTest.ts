import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as organizationInventoryPage from '../../Base/pages/OrganizationInventory.po';
import { OrganizationInventoryPageData } from '../../Base/pagedata/OrganizationInventoryPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';
import { faker } from '@faker-js/faker';
import * as logoutPage from '../../Base/pages/Logout.po';
import * as organizationTagsUserPage from '../../Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../Base/pagedata/OrganizationTagsPageData';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';


const pageLoadTimeout = Cypress.config('pageLoadTimeout');

let email = faker.internet.exampleEmail();
let website = faker.internet.url();
let description = faker.lorem.text();
let city = faker.location.city();
let postcode = faker.location.zipCode();
let address = faker.location.streetAddress();

// Login with email
Given('Login with default credentials', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

// Add new tag
Then('User can add new tag', () => {
	dashboardPage.verifyAccountingDashboard();
	CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
});

// Add new product category
And('User can visit Organization inventory page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/organization/inventory', {
		timeout: pageLoadTimeout
	});
});

And('User can see grid button', () => {
	organizationInventoryPage.gridBtnExists();
});

And('User can click on second grid button to change view', () => {
	cy.on('uncaught:exception', (err, runnable) => {
		return false;
	});
	organizationInventoryPage.gridBtnClick(1);
});

And('User can see add category button', () => {
	organizationInventoryPage.addCategoryOrTypeButtonVisible();
});

When('User click on add category button', () => {
	organizationInventoryPage.clickAddCategoryOrTypeButton(
		OrganizationInventoryPageData.categoryButtonText
	);
});

And('User can see add button', () => {
	cy.on('uncaught:exception', (err, runnable) => {
		return false;
	});
	organizationInventoryPage.addButtonVisible();
});

When('User click on add button', () => {
	cy.on('uncaught:exception', (err, runnable) => {
		return false;
	});
	organizationInventoryPage.clickAddButton();
});

Then('User can see category name input field', () => {
	organizationInventoryPage.nameInputVisible();
});

And('User can enter value for category name', () => {
	organizationInventoryPage.enterNameInputData(
		OrganizationInventoryPageData.productCategoryName
	);
});

And('User can see category description input field', () => {
	organizationInventoryPage.descriptionInputVisible();
});

And('User can enter value for category description', () => {
	organizationInventoryPage.enterDescriptionInputData(
		OrganizationInventoryPageData.productCategoryDescription
	);
});

And('User can see save category button', () => {
	organizationInventoryPage.saveButtonVisible();
});

When('User click on save category button', () => {
	organizationInventoryPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	organizationInventoryPage.waitMessageToHide();
});

And('User can see back button', () => {
	organizationInventoryPage.backButtonVisible();
});

When('User click on back button', () => {
	organizationInventoryPage.clickBackButton();
});

// Add new product type
Then('User can click on add type button', () => {
	organizationInventoryPage.clickAddCategoryOrTypeButton(
		OrganizationInventoryPageData.typeButtonText
	);
});

And('User can see add product type button', () => {
	organizationInventoryPage.addButtonVisible();
});

When('User click on add product type button', () => {
	organizationInventoryPage.clickAddButton();
});

Then('User can see type name input field', () => {
	organizationInventoryPage.nameInputVisible();
});

And('User can enter value for type name', () => {
	organizationInventoryPage.enterNameInputData(
		OrganizationInventoryPageData.productTypeName
	);
});

And('User can see type category input field', () => {
	organizationInventoryPage.descriptionInputVisible();
});

And('User can enter value for type description', () => {
	organizationInventoryPage.enterDescriptionInputData(
		OrganizationInventoryPageData.productTypeDescription
	);
});

And('User can see save type button', () => {
	organizationInventoryPage.saveButtonVisible();
});

When('User click on save type button', () => {
	organizationInventoryPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	organizationInventoryPage.waitMessageToHide();
});

And('User can see back button', () => {
	organizationInventoryPage.backButtonVisible();
});

When('User click on back button', () => {
	organizationInventoryPage.clickBackButton();
});

// Add new inventory
Then('User can see add inventory button', () => {
	organizationInventoryPage.addButtonVisible();
});

When('User click on add inventory button', () => {
	organizationInventoryPage.clickAddButton();
});

And('User can see inventory name input field', () => {
	organizationInventoryPage.nameInputVisible();
});

And('User can add value for inventory name', () => {
	organizationInventoryPage.enterNameInputData(
		OrganizationInventoryPageData.inventoryName
	);
});

And('User can se code input field', () => {
	organizationInventoryPage.codeInputVisible();
});

And('User can enter value for code', () => {
	organizationInventoryPage.enterCodeInputData(
		OrganizationInventoryPageData.defaultInventoryCode
	);
});

And('User can see product dropdown', () => {
	organizationInventoryPage.productTypeDropdownVisible();
});

When('User click on product dropdown', () => {
	organizationInventoryPage.clickProductTypeDropdown();
});

Then('User can select product from dropdown options', () => {
	organizationInventoryPage.clickDropdownOption(0);
});

And('User can see category dropdown', () => {
	organizationInventoryPage.productCategoryDropdownVisible();
});

When('User click on category dropdown', () => {
	organizationInventoryPage.clickProductCategoryDropdown();
});

Then('User can select category from dropdown options', () => {
	organizationInventoryPage.clickDropdownOption(0);
});

And('User can see inventory description input field', () => {
	organizationInventoryPage.descriptionInputVisible();
});

And('User can enter  value for inventory description', () => {
	organizationInventoryPage.enterDescriptionInputData(
		OrganizationInventoryPageData.productInventoryDescription
	);
});

And('User can see save inventory button', () => {
	organizationInventoryPage.saveButtonVisible();
});

When('User click on save inventory button', () => {
	organizationInventoryPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	organizationInventoryPage.waitMessageToHide();
});

And('User user can see back from inventory page button', () => {
	organizationInventoryPage.backFromInventoryButtonVisible();
});

When('User click back from inventory page button', () => {
	organizationInventoryPage.clickBackFromInventoryButton();
});

Then('User can click on back button again', () => {
	organizationInventoryPage.clickBackFromInventoryButton();
});

// Edit inventory
And('User can see inventory table', () => {
	organizationInventoryPage.tableRowVisible();
});

When('User select inventory table row', () => {
	organizationInventoryPage.selectTableRow(0);
});

Then('Edit inventory button will become active', () => {
	organizationInventoryPage.editButtonVisible();
});

When('User click on edit inventory button', () => {
	organizationInventoryPage.clickEditButton();
});

Then('User can see edit inventory name input field', () => {
	organizationInventoryPage.nameInputVisible();
});

And('User can enter new inventory name', () => {
	organizationInventoryPage.enterNameInputData(
		OrganizationInventoryPageData.productTypeName
	);
});

And('User can see edit code input field', () => {
	organizationInventoryPage.codeInputVisible();
});

And('User can enter new code', () => {
	organizationInventoryPage.enterCodeInputData(
		OrganizationInventoryPageData.defaultInventoryCode
	);
});

And('User can see edit description input field', () => {
	organizationInventoryPage.descriptionInputVisible();
});

And('User can enter new description', () => {
	organizationInventoryPage.enterDescriptionInputData(
		OrganizationInventoryPageData.productInventoryDescription
	);
});

And('User can see save edited inventory button', () => {
	organizationInventoryPage.saveButtonVisible();
});

When('User click on save edited inventory button', () => {
	organizationInventoryPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	organizationInventoryPage.waitMessageToHide();
});

And('User user can see back from inventory page button', () => {
	organizationInventoryPage.backFromInventoryButtonVisible();
});

When('User click back from inventory page button', () => {
	organizationInventoryPage.clickBackFromInventoryButton();
});

// Delete inventory
Then('User can see inventory table again', () => {
	organizationInventoryPage.tableRowVisible();
});

When('User select again inventory table row', () => {
	organizationInventoryPage.selectTableRow(0);
});

Then('User can see delete inventory button', () => {
	organizationInventoryPage.deleteButtonVisible();
});

When('User click on delete inventory button', () => {
	organizationInventoryPage.clickDeleteButton();
});

Then('User can see confirm delete inventory button', () => {
	organizationInventoryPage.confirmDeleteButtonVisible();
});

When('User click on confirm delete inventory button', () => {
	organizationInventoryPage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	organizationInventoryPage.waitMessageToHide();
});

// Edit product category
And('User can see add category button', () => {
	organizationInventoryPage.addCategoryOrTypeButtonVisible();
});

When('User click on add category button', () => {
	organizationInventoryPage.clickAddCategoryOrTypeButton(
		OrganizationInventoryPageData.categoryButtonText
	);
});

Then('User can see category table', () => {
	organizationInventoryPage.tableRowVisible();
});

When('User click on category table row', () => {
	organizationInventoryPage.selectTableRow(0);
});

Then('Edit category button will become active', () => {
	organizationInventoryPage.editButtonVisible();
});

When('User click on edit category button', () => {
	organizationInventoryPage.clickEditButton();
});

Then('User can see edit category name input field', () => {
	organizationInventoryPage.nameInputVisible();
});

And('User can enter new category name', () => {
	organizationInventoryPage.enterNameInputData(
		OrganizationInventoryPageData.productCategoryName
	);
});

And('User can see edit description input field', () => {
	organizationInventoryPage.descriptionInputVisible();
});

And('User can enter new category description', () => {
	organizationInventoryPage.enterDescriptionInputData(
		OrganizationInventoryPageData.productCategoryDescription
	);
});

And('User can see save edited category button', () => {
	organizationInventoryPage.saveButtonVisible();
});

When('User click on save edited category button', () => {
	organizationInventoryPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	organizationInventoryPage.waitMessageToHide();
});

// Delete product category
And('User can see category table again', () => {
	organizationInventoryPage.tableRowVisible();
});

When('User click again on category table row', () => {
	organizationInventoryPage.selectTableRow(0);
});

Then('Delete category button will become active', () => {
	organizationInventoryPage.deleteButtonVisible();
});

When('User click on delete category button', () => {
	organizationInventoryPage.clickDeleteButton();
});

Then('User can see confirm delete category button', () => {
	organizationInventoryPage.confirmDeleteButtonVisible();
});

When('User click on confirm delete category button', () => {
	organizationInventoryPage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	organizationInventoryPage.waitMessageToHide();
});

And('User can see back from category button', () => {
	organizationInventoryPage.backButtonVisible();
});

When('User click on back from category button', () => {
	organizationInventoryPage.clickBackButton();
});

// Edit product type
Then('User can see add product type button again', () => {
	organizationInventoryPage.addCategoryOrTypeButtonVisible();
});

When('User click on add product type button again', () => {
	organizationInventoryPage.clickAddCategoryOrTypeButton(
		OrganizationInventoryPageData.typeButtonText
	);
});

Then('User can see product types table', () => {
	organizationInventoryPage.tableRowVisible();
});

When('User click on product types table row', () => {
	organizationInventoryPage.selectTableRow(0);
});

Then('User can see edit product type button', () => {
	organizationInventoryPage.editButtonVisible();
});

When('User click on edit product type button', () => {
	organizationInventoryPage.clickEditButton();
});

Then('User can see edit product type name input field', () => {
	organizationInventoryPage.nameInputVisible();
});

And('User can enter new product type name', () => {
	organizationInventoryPage.enterNameInputData(
		OrganizationInventoryPageData.productTypeName
	);
});

And('User can see edit product type description input field', () => {
	organizationInventoryPage.descriptionInputVisible();
});

And('User can enter new product type description', () => {
	organizationInventoryPage.enterDescriptionInputData(
		OrganizationInventoryPageData.productTypeDescription
	);
});

And('User can see save edited product type button', () => {
	organizationInventoryPage.saveButtonVisible();
});

When('User click on save edited product type button', () => {
	organizationInventoryPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	organizationInventoryPage.waitMessageToHide();
});

// Delete product type
And('User can see again product types table', () => {
	organizationInventoryPage.tableRowVisible();
});

When('User click again on product types table row', () => {
	organizationInventoryPage.selectTableRow(0);
});

Then('Delete product type button will become active', () => {
	organizationInventoryPage.deleteButtonVisible();
});

When('User click on delete product type button', () => {
	organizationInventoryPage.clickDeleteButton();
});

Then('User can see confirm delete product type button', () => {
	organizationInventoryPage.confirmDeleteButtonVisible();
});

When('User click on confirm delete product type button', () => {
	organizationInventoryPage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	organizationInventoryPage.waitMessageToHide();
});

// Add warehouse
And('User can see sidebar menu buttons', () => {
	organizationInventoryPage.sidebarBtnVisible();
});

When('User click on Organization sidebar button', () => {
	organizationInventoryPage.clickSidebarBtn(
		OrganizationInventoryPageData.organization
	);
});

Then('User can click on Inventory sidebar button', () => {
	organizationInventoryPage.clickInventorySidebarBtn();
});

And('User can see Warehouses button', () => {
	organizationInventoryPage.merchantOrWarehouseBtnVisible();
});

When('User click on Warehouses button', () => {
	organizationInventoryPage.clickMerchantOrWarehouseBtn(
		OrganizationInventoryPageData.warehouses
	);
});

Then('User can see Add warehouse button', () => {
	organizationInventoryPage.addWarehouseBtnVisible();
});

When('User click on Add warehouse button', () => {
	organizationInventoryPage.clickAddWarehouseBtn();
});

Then('User can see warehouse name input field', () => {
	organizationInventoryPage.warehouseNameInputVisible();
});

And('User can enter value for warehouse name', () => {
	organizationInventoryPage.enterWarehouseName(
		OrganizationInventoryPageData.warehouseName
	);
});

And('User can see warehouse tags select', () => {
	organizationInventoryPage.tagsSelectVisible();
});

When('User click on warehouse tags select', () => {
	organizationInventoryPage.clickTagsSelect();
});

Then('User can select warehouse tag from dropdown options', () => {
	organizationInventoryPage.selectTagFromDropdownOptions(0);
});

And('User can see warehouse code input field', () => {
	organizationInventoryPage.warehouseCodeInputVisible();
});

And('User can enter warehouse code', () => {
	organizationInventoryPage.enterWarehouseCode(
		OrganizationInventoryPageData.warehouseCode
	);
});

And('User can see warehouse email input field', () => {
	organizationInventoryPage.warehouseEmailInputVisible();
});

And('User can enter value for warehouse email', () => {
	organizationInventoryPage.enterWarehouseEmail(email);
});

And('User can see warehouse active state checkbox', () => {
	organizationInventoryPage.activeStateCheckBoxVisible();
});

And('User can click on warehouse active state checkbox', () => {
	organizationInventoryPage.clickActiveStateCheckbox();
});

And('User can see warehouse description input field', () => {
	organizationInventoryPage.warehouseDescriptionInputVisible();
});

And('User can enter value for merchant description', () => {
	organizationInventoryPage.enterWarehouseDescription(description);
});

And('User can see tab button', () => {
	organizationInventoryPage.tabBtnVisible();
});

When('User click on Location tab button', () => {
	organizationInventoryPage.clickTabBtn(
		OrganizationInventoryPageData.location
	);
});

Then('User can see warehouse country select', () => {
	organizationInventoryPage.countrySelectVisible();
});

When('User click on warehouse country select', () => {
	organizationInventoryPage.clickCountrySelect();
});

Then('User can select warehouse country from dropdown options', () => {
	organizationInventoryPage.selectCountryFromDropdownOptions(
		OrganizationInventoryPageData.country
	);
});

And('User can see warehouse city input field', () => {
	organizationInventoryPage.cityInputVisible();
});

And('User can enter value for warehouse city', () => {
	organizationInventoryPage.enterCity(city);
});

And('User can see warehouse postcode input field', () => {
	organizationInventoryPage.postcodeInputVisible();
});

And('User can enter value for warehouse postcode', () => {
	organizationInventoryPage.enterPostcode(postcode);
});

And('User can see warehouse address input field', () => {
	organizationInventoryPage.addressInputVisible();
});

And('User can enter value for warehouse address', () => {
	organizationInventoryPage.enterAddress(address);
});

And('User can see save warehouse button', () => {
	organizationInventoryPage.saveWarehouseBtnVisible();
});

When('User click on save warehouse button', () => {
	organizationInventoryPage.clickSaveWarehouseBtn();
});

Then('Notification message will appear', () => {
	organizationInventoryPage.waitMessageToHide();
});

And('User can verify Warehouse was created', () => {
	organizationInventoryPage.verifyMerchantWarehouse(
		OrganizationInventoryPageData.warehouseName
	);
});

// Add merchant
When('User click again on Inventory sidebar menu button', () => {
	organizationInventoryPage.clickInventorySidebarBtn();
});

Then('User can see Merchants button', () => {
	organizationInventoryPage.merchantOrWarehouseBtnVisible();
});

When('User click on Merchants button', () => {
	organizationInventoryPage.clickMerchantOrWarehouseBtn(
		OrganizationInventoryPageData.merchants
	);
});

Then('User can see Add merchant button', () => {
	organizationInventoryPage.addMerchantBtnVisible();
});

When('User click on Add merchant button', () => {
	organizationInventoryPage.clickAddMerchantBtn();
});

Then('User can see merchant name input field', () => {
	organizationInventoryPage.merchantNameInputVisible();
});

And('User can enter merchant name', () => {
	organizationInventoryPage.enterMerchantNameInput(
		OrganizationInventoryPageData.merchantName
	);
});

And('User can see merchant code input field', () => {
	organizationInventoryPage.merchantCodeInputVisible();
});

And('User can enter merchant code', () => {
	organizationInventoryPage.enterMerchantCode(
		OrganizationInventoryPageData.merchantCode
	);
});

And('User can see merchant email input field', () => {
	organizationInventoryPage.merchantEmailInputVisible();
});

And('User can enter value for merchant email', () => {
	organizationInventoryPage.enterMerchantEmail(email);
});

And('User can see currency select', () => {
	organizationInventoryPage.merchantCurrencySelectVisible();
});

When('User click on currency select', () => {
	organizationInventoryPage.clickMerchantCurrencySelect();
});

Then('User can select currency from dropdown options', () => {
	organizationInventoryPage.selectCurrencyFromDropdownOptions(
		OrganizationInventoryPageData.currency
	);
});

And('User can see merchant website input field', () => {
	organizationInventoryPage.merchantWebsiteInputVisible();
});

And('User can enter value for merchant website', () => {
	organizationInventoryPage.enterMerchantWebsite(website);
});

And('User can see merchant tags select', () => {
	organizationInventoryPage.tagsSelectVisible();
});

When('User click on merchant tags select', () => {
	organizationInventoryPage.clickTagsSelect();
});

Then('User can select merchant tag from dropdown options', () => {
	organizationInventoryPage.selectTagFromDropdownOptions(0);
});

And('User can see merchant description input field', () => {
	organizationInventoryPage.merchantDescriptionInputVisible();
});

And('User can enter value for merchant description', () => {
	organizationInventoryPage.enterMerchantDescription(description);
});

And('User can see merchant active state checkbox', () => {
	organizationInventoryPage.activeStateCheckBoxVisible();
});

And('User can click on merchant active state checkbox', () => {
	organizationInventoryPage.clickActiveStateCheckbox();
});

And('User can see next step button', () => {
	organizationInventoryPage.merchantNextBtnVisible();
});

When('User click on next step button', () => {
	organizationInventoryPage.clickMerchantNextBtn(
		OrganizationInventoryPageData.nextBtn
	);
});

Then('User can see merchant country select', () => {
	organizationInventoryPage.countrySelectVisible();
});

When('User click on merchant country select', () => {
	organizationInventoryPage.clickCountrySelect();
});

Then('User can select merchant country from dropdown options', () => {
	organizationInventoryPage.selectCountryFromDropdownOptions(
		OrganizationInventoryPageData.country
	);
});

And('User can see merchant city input field', () => {
	organizationInventoryPage.cityInputVisible();
});

And('User can enter value for merchant city', () => {
	organizationInventoryPage.enterCity(city);
});

And('User can see merchant postcode input field', () => {
	organizationInventoryPage.postcodeInputVisible();
});

And('User can enter value for merchant postcode', () => {
	organizationInventoryPage.enterPostcode(postcode);
});

And('User can see merchant address input field', () => {
	organizationInventoryPage.addressInputVisible();
});

And('User can enter value for merchant address', () => {
	organizationInventoryPage.enterAddress(address);
});

And('User can see last step button', () => {
	organizationInventoryPage.merchantNextBtnVisible();
});

When('User click on last step button', () => {
	organizationInventoryPage.clickMerchantNextBtn(
		OrganizationInventoryPageData.nextBtn
	);
});

And('User can see warehouse select', () => {
	organizationInventoryPage.warehousesSelectVisible();
});

When('User click on warehouses select', () => {
	organizationInventoryPage.clickWarehousesSelect();
});

Then('User can select warehouse from dropdown options', () => { });

And('User can see save merchant button', () => {
	organizationInventoryPage.saveMerchantBtnVisible();
});

When('User click on save merchant button', () => {
	organizationInventoryPage.clickSaveMerchantBtn();
});

Then('Notification message will appear', () => {
	organizationInventoryPage.waitMessageToHide();
});

And('User can verify Merchant was created', () => {
	organizationInventoryPage.verifyMerchantWarehouse(
		OrganizationInventoryPageData.merchantName
	);
});

// Edit Merchant
And('User can see merchants table', () => {
	organizationInventoryPage.tableRowVisible();
});

When('User click on merchants table row', () => {
	organizationInventoryPage.selectTableRow(0);
});

Then('Edit merchant button will become active', () => {
	organizationInventoryPage.editMerchantBtnVisible();
});

When('User click on edit merchant name', () => {
	organizationInventoryPage.clickEditMerchantBtn();
});

Then('User can see again merchant name input field', () => {
	organizationInventoryPage.merchantNameInputVisible();
});

And('User can enter new value for merchant name', () => {
	organizationInventoryPage.enterMerchantNameInput(
		OrganizationInventoryPageData.editMerchantName
	);
});

And('User can see again next step button', () => {
	organizationInventoryPage.merchantNextBtnVisible();
});

When('User click on next step button again', () => {
	organizationInventoryPage.clickMerchantNextBtn(
		OrganizationInventoryPageData.nextBtn
	);
});

Then('User can click again on last step button', () => {
	organizationInventoryPage.clickMerchantNextBtn(
		OrganizationInventoryPageData.nextBtn
	);
});

And('User can see again save merchant button', () => {
	organizationInventoryPage.saveMerchantBtnVisible();
});

When('User click on save edited merchant button', () => {
	organizationInventoryPage.clickSaveMerchantBtn();
});

Then('Notification message will appear', () => {
	organizationInventoryPage.waitMessageToHide();
});

And('User can verify Merchant was edited', () => {
	organizationInventoryPage.verifyMerchantWarehouse(
		OrganizationInventoryPageData.editMerchantName
	);
});

// Delete merchant
And('User can see merchants table again', () => {
	organizationInventoryPage.tableRowVisible();
});

When('User click again on merchants table row', () => {
	organizationInventoryPage.selectTableRow(0);
});

Then('Delete merchant button will become active', () => {
	organizationInventoryPage.deleteMerchantBtnVisible();
});

When('User click on delete merchant button', () => {
	organizationInventoryPage.clickDeleteMerchantBtn();
});

Then('User click on delete button to confirm', () => {
	organizationInventoryPage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	organizationInventoryPage.waitMessageToHide();
});

// Edit warehouse
When('User click on Inventory sidebar button again', () => {
	organizationInventoryPage.clickInventorySidebarBtn();
});

Then('User can see Warehouses button again', () => {
	organizationInventoryPage.merchantOrWarehouseBtnVisible();
});

When('User click on Warehouses button again', () => {
	organizationInventoryPage.clickMerchantOrWarehouseBtn(
		OrganizationInventoryPageData.warehouses
	);
});

Then('User can see warehouses table', () => {
	organizationInventoryPage.tableRowVisible();
});

When('User click on warehouses table row', () => {
	organizationInventoryPage.selectTableRow(0);
});

Then('Edit warehouse button will become active', () => {
	organizationInventoryPage.editWarehouseBtnVisible();
});

When('User click on edit warehouse button', () => {
	organizationInventoryPage.clickEditWarehouseBtn();
});

Then('User can see warehouse name input field again', () => {
	organizationInventoryPage.warehouseNameInputVisible();
});

And('User can enter new value for warehouse name', () => {
	organizationInventoryPage.enterWarehouseName(
		OrganizationInventoryPageData.editWarehouseName
	);
});

And('User can see save edited warehouse button', () => {
	organizationInventoryPage.saveWarehouseBtnVisible();
});

When('User click on save edited warehouse button', () => {
	organizationInventoryPage.clickSaveWarehouseBtn();
});

Then('Notification message will appear', () => {
	organizationInventoryPage.waitMessageToHide();
});

And('User can verify warehouse was edited', () => {
	organizationInventoryPage.verifyMerchantWarehouse(
		OrganizationInventoryPageData.editWarehouseName
	);
});

// Delete warehouse
And('User can see warehouses table again', () => {
	organizationInventoryPage.tableRowVisible();
});

When('User click on warehouses table row again', () => {
	organizationInventoryPage.selectTableRow(0);
});

Then('Delete warehouse button will become active', () => {
	organizationInventoryPage.deleteWarehouseBtnVisible();
});

When('User click on delete warehouse button', () => {
	organizationInventoryPage.clickDeleteWarehouseBtn();
});

Then('User can see confirm delete warehouse button', () => {
	organizationInventoryPage.confirmDeleteButtonVisible();
});

When('User click on confirm delete warehouse button', () => {
	organizationInventoryPage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	organizationInventoryPage.waitMessageToHide();
});
