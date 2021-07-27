import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as organizationInventoryPage from '../../Base/pages/OrganizationInventory.po';
import { OrganizationInventoryPageData } from '../../Base/pagedata/OrganizationInventoryPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

// Login with email
Given(
	'Login with default credentials and visit Organization inventory page',
	() => {
		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
		cy.visit('/#/pages/organization/inventory/all');
	}
);

// Add new product category
And('User can see grid button', () => {
	organizationInventoryPage.gridBtnExists();
});

And('User can click on second grid button to change view', () => {
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
	organizationInventoryPage.descriptionInputVisivle();
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
	organizationInventoryPage.descriptionInputVisivle();
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
	organizationInventoryPage.clickProductTypeDrodpwon();
});

Then('User can select product from dropdown options', () => {
	organizationInventoryPage.clickDropdownOption(0);
});

And('User can see category dropdown', () => {
	organizationInventoryPage.productCategoryDropdownVisible();
});

When('User click on category dropdown', () => {
	organizationInventoryPage.clickProductCategoryDrodpwon();
});

Then('User can select category from dropdown options', () => {
	organizationInventoryPage.clickDropdownOption(0);
});

And('User can see inventory description input field', () => {
	organizationInventoryPage.descriptionInputVisivle();
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
})

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

Then('User can see editn inventory name input field', () => {
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
	organizationInventoryPage.descriptionInputVisivle();
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
	organizationInventoryPage.descriptionInputVisivle();
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
	organizationInventoryPage.descriptionInputVisivle();
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
