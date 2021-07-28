import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as organizationTagsUserPage from '../../Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../Base/pagedata/OrganizationTagsPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

// Login with email
Given('Login with default credentials and visit Organization tags page', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/organization/tags');
});

// Add tag
And('User can see grid button', () => {
	organizationTagsUserPage.gridButtonVisible();
});

And('User can click on second grid button to change view', () => {
	organizationTagsUserPage.clickGridButton(1);
});

And('User can see add tag button', () => {
	organizationTagsUserPage.addTagButtonVisible();
});

When('User click on add tag button', () => {
	organizationTagsUserPage.clickAddTagButton();
});

Then('User can see tag name input field', () => {
	organizationTagsUserPage.tagNameInputVisible();
});

And('User can enter tag name', () => {
	organizationTagsUserPage.enterTagNameData(OrganizationTagsPageData.tagName);
});

And('User can see color input field', () => {
	organizationTagsUserPage.tagColorInputVisible();
});

And('User can enter value for color', () => {
	organizationTagsUserPage.enterTagColorData(
		OrganizationTagsPageData.tagColor
	);
});

And('User can see description input field', () => {
	organizationTagsUserPage.tagDescriptionTextareaVisible();
});

And('User can enter description text', () => {
	organizationTagsUserPage.enterTagDescriptionData(
		OrganizationTagsPageData.tagDescription
	);
});

And('User can see save tag button', () => {
	organizationTagsUserPage.saveTagButtonVisible();
});

When('User click on save tag button', () => {
	organizationTagsUserPage.clickSaveTagButton();
});

Then('Notification message will appear', () => {
	organizationTagsUserPage.waitMessageToHide();
});

// Edit tag
And('User can see tags table', () => {
	organizationTagsUserPage.tagsTableDataVisible();
});

When('User click on tags table row', () => {
	organizationTagsUserPage.selectTableRow(0);
});

Then('Edit tag button will become active', () => {
	organizationTagsUserPage.editTagButtonVisible();
});

When('User click on edit tag button', () => {
	organizationTagsUserPage.clickEditTagButton();
});

Then('User can see tag name input field again', () => {
	organizationTagsUserPage.tagNameInputVisible();
});

And('User can enter new tag name', () => {
	organizationTagsUserPage.enterTagNameData(
		OrganizationTagsPageData.editTagName
	);
});

And('User can see tag color input field again', () => {
	organizationTagsUserPage.tagColorInputVisible();
});

And('User can enter new tag color', () => {
	organizationTagsUserPage.enterTagColorData(
		OrganizationTagsPageData.tagColor
	);
});

And('User can see tag description input field again', () => {
	organizationTagsUserPage.tagDescriptionTextareaVisible();
});

And('User can enter new description', () => {
	organizationTagsUserPage.enterTagDescriptionData(
		OrganizationTagsPageData.tagDescription
	);
});

And('User can see save edited tag button', () => {
	organizationTagsUserPage.saveTagButtonVisible();
});

When('User click on save edited tag button', () => {
	organizationTagsUserPage.clickSaveTagButton();
});

Then('Notification message will appear', () => {
	organizationTagsUserPage.waitMessageToHide();
});

// Delete tag
And('User can see tags table again', () => {
	organizationTagsUserPage.tagsTableDataVisible();
});

When('User click on tags table row again', () => {
	organizationTagsUserPage.selectTableRow(0);
});

Then('Delete tag button will become active', () => {
	organizationTagsUserPage.deleteTagButtonVisible();
});

When('User click on delete tag button', () => {
	organizationTagsUserPage.clickDeleteTagButton();
});

Then('User can see confirm delete tag button', () => {
	organizationTagsUserPage.confirmDeleteTagButtonVisible();
});

When('User click on confirm delete tag button', () => {
	organizationTagsUserPage.clickConfirmDeleteTagButton();
});

Then('Notification message will appear', () => {
	organizationTagsUserPage.waitMessageToHide();
});
