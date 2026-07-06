import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as organizationInventoryPage from '../../support/pages/OrganizationInventory.po';
import { OrganizationInventoryPageData } from '../../../src/support/Base/pagedata/OrganizationInventoryPageData';

// Converted 1:1 from the plain OrganizationInventoryTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence, so runtime behaviour is
// identical to the already-CI-tested spec. The `Given I am logged in as the default user` Background step
// is defined once in common.steps.ts.

When('I add a new product category', async () => {
	await getPage().goto('/#/pages/organization/inventory');
	await organizationInventoryPage.gridBtnExists();
	await organizationInventoryPage.gridBtnClick(1);
	await organizationInventoryPage.addCategoryOrTypeButtonVisible();
	await organizationInventoryPage.clickAddCategoryOrTypeButton(
		OrganizationInventoryPageData.categoryButtonText
	);
	await organizationInventoryPage.addButtonVisible();
	await organizationInventoryPage.clickAddButton();
	await organizationInventoryPage.nameInputVisible();
	await organizationInventoryPage.enterNameInputData(
		OrganizationInventoryPageData.productCategoryName
	);
	await organizationInventoryPage.descriptionInputVisible();
	await organizationInventoryPage.enterDescriptionInputData(
		OrganizationInventoryPageData.productCategoryDescription
	);
	await organizationInventoryPage.saveButtonVisible();
	await organizationInventoryPage.clickSaveButton();
	await organizationInventoryPage.waitMessageToHide();
	await organizationInventoryPage.verifyCategoryExists(
		OrganizationInventoryPageData.productCategoryName
	);
	await organizationInventoryPage.backButtonVisible();
	await organizationInventoryPage.clickBackButton();
});

When('I add a new product type', async () => {
	await organizationInventoryPage.clickAddCategoryOrTypeButton(
		OrganizationInventoryPageData.typeButtonText
	);
	await organizationInventoryPage.addButtonVisible();
	await organizationInventoryPage.clickAddButton();
	await organizationInventoryPage.nameInputVisible();
	await organizationInventoryPage.enterNameInputData(
		OrganizationInventoryPageData.productTypeName
	);
	await organizationInventoryPage.descriptionInputVisible();
	await organizationInventoryPage.enterDescriptionInputData(
		OrganizationInventoryPageData.productTypeDescription
	);
	await organizationInventoryPage.saveButtonVisible();
	await organizationInventoryPage.clickSaveButton();
	await organizationInventoryPage.waitMessageToHide();
	await organizationInventoryPage.verifyTypeExists(
		OrganizationInventoryPageData.productTypeName
	);
	await organizationInventoryPage.backButtonVisible();
	await organizationInventoryPage.clickBackButton();
});

When('I add a new inventory item', async () => {
	await organizationInventoryPage.addButtonVisible();
	await organizationInventoryPage.clickAddButton();
	await organizationInventoryPage.languageDropdownVisible();
	await organizationInventoryPage.clickLanguageDropdown();
	await organizationInventoryPage.clickDropdownOption(
		OrganizationInventoryPageData.defaultInventoryLanguage
	);
	await organizationInventoryPage.nameInputVisible();
	await organizationInventoryPage.enterNameInputData(
		OrganizationInventoryPageData.inventoryName
	);
	await organizationInventoryPage.codeInputVisible();
	await organizationInventoryPage.enterCodeInputData(
		OrganizationInventoryPageData.defaultInventoryCode
	);
	await organizationInventoryPage.productTypeDropdownVisible();
	await organizationInventoryPage.clickProductTypeDropdown();
	await organizationInventoryPage.clickDropdownOption(
		OrganizationInventoryPageData.productTypeName
	);
	await organizationInventoryPage.productCategoryDropdownVisible();
	await organizationInventoryPage.clickProductCategoryDropdown();
	await organizationInventoryPage.clickDropdownOption(
		OrganizationInventoryPageData.productCategoryName
	);
	await organizationInventoryPage.descriptionInputVisible();
	await organizationInventoryPage.enterDescriptionInputData(
		OrganizationInventoryPageData.productInventoryDescription
	);
	await organizationInventoryPage.saveButtonVisible();
	await organizationInventoryPage.clickSaveButton();
	await organizationInventoryPage.waitMessageToHide();
	await organizationInventoryPage.backFromInventoryButtonVisible();
	await organizationInventoryPage.clickBackFromInventoryButton();
	await organizationInventoryPage.verifyInventoryExists(
		OrganizationInventoryPageData.inventoryName
	);
});

When('I edit the inventory item', async () => {
	await organizationInventoryPage.tableRowVisible();
	await organizationInventoryPage.selectTableRow(0);
	await organizationInventoryPage.editButtonVisible();
	await organizationInventoryPage.clickEditButton();
	await organizationInventoryPage.nameInputVisible();
	await organizationInventoryPage.enterNameInputData(
		OrganizationInventoryPageData.productTypeName
	);
	await organizationInventoryPage.codeInputVisible();
	await organizationInventoryPage.enterCodeInputData(
		OrganizationInventoryPageData.defaultInventoryCode
	);
	await organizationInventoryPage.descriptionInputVisible();
	await organizationInventoryPage.enterDescriptionInputData(
		OrganizationInventoryPageData.productInventoryDescription
	);
	await organizationInventoryPage.saveButtonVisible();
	await organizationInventoryPage.clickSaveButton();
	await organizationInventoryPage.waitMessageToHide();
	await organizationInventoryPage.backFromInventoryButtonVisible();
	await organizationInventoryPage.clickBackFromInventoryButton();
});

When('I delete the inventory item', async () => {
	await organizationInventoryPage.selectTableRow(0);
	await organizationInventoryPage.deleteButtonVisible();
	await organizationInventoryPage.clickDeleteButton();
	await organizationInventoryPage.confirmDeleteButtonVisible();
	await organizationInventoryPage.clickConfirmDeleteButton();
	await organizationInventoryPage.waitMessageToHide();
	await organizationInventoryPage.verifyInventoryIsDeleted();
});

When('I edit the product category', async () => {
	await organizationInventoryPage.addCategoryOrTypeButtonVisible();
	await organizationInventoryPage.clickAddCategoryOrTypeButton(
		OrganizationInventoryPageData.categoryButtonText
	);
	await organizationInventoryPage.tableRowVisible();
	await organizationInventoryPage.selectTableRow(0);
	await organizationInventoryPage.editButtonVisible();
	await organizationInventoryPage.clickEditButton();
	await organizationInventoryPage.nameInputVisible();
	await organizationInventoryPage.enterNameInputData(
		OrganizationInventoryPageData.productCategoryName
	);
	await organizationInventoryPage.descriptionInputVisible();
	await organizationInventoryPage.enterDescriptionInputData(
		OrganizationInventoryPageData.productCategoryDescription
	);
	await organizationInventoryPage.saveButtonVisible();
	await organizationInventoryPage.clickSaveButton();
});

When('I delete the product category', async () => {
	await organizationInventoryPage.waitMessageToHide();
	await organizationInventoryPage.selectTableRow(0);
	await organizationInventoryPage.deleteButtonVisible();
	await organizationInventoryPage.clickDeleteButton();
	await organizationInventoryPage.confirmDeleteButtonVisible();
	await organizationInventoryPage.clickConfirmDeleteButton();
	await organizationInventoryPage.waitMessageToHide();
	await organizationInventoryPage.verifyCategoryIsDeleted(
		OrganizationInventoryPageData.productCategoryName
	);
	await organizationInventoryPage.backButtonVisible();
	await organizationInventoryPage.clickBackButton();
});

When('I edit the product type', async () => {
	await organizationInventoryPage.addCategoryOrTypeButtonVisible();
	await organizationInventoryPage.clickAddCategoryOrTypeButton(
		OrganizationInventoryPageData.typeButtonText
	);
	await organizationInventoryPage.tableRowVisible();
	await organizationInventoryPage.selectTableRow(0);
	await organizationInventoryPage.editButtonVisible();
	await organizationInventoryPage.clickEditButton();
	await organizationInventoryPage.nameInputVisible();
	await organizationInventoryPage.enterNameInputData(
		OrganizationInventoryPageData.productTypeName
	);
	await organizationInventoryPage.descriptionInputVisible();
	await organizationInventoryPage.enterDescriptionInputData(
		OrganizationInventoryPageData.productTypeDescription
	);
	await organizationInventoryPage.saveButtonVisible();
	await organizationInventoryPage.clickSaveButton();
});

When('I delete the product type', async () => {
	await organizationInventoryPage.waitMessageToHide();
	await organizationInventoryPage.tableRowVisible();
	await organizationInventoryPage.selectTableRow(0);
	await organizationInventoryPage.deleteButtonVisible();
	await organizationInventoryPage.clickDeleteButton();
	await organizationInventoryPage.confirmDeleteButtonVisible();
	await organizationInventoryPage.clickConfirmDeleteButton();
	await organizationInventoryPage.waitMessageToHide();
	await organizationInventoryPage.verifyTypeIsDeleted(
		OrganizationInventoryPageData.productTypeName
	);
});
