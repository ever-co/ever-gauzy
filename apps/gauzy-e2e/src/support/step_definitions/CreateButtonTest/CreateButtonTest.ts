import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as createButton from '../../Base/pages/CreateButton.po';
import { CreateButtonData } from '../../Base/pagedata/CreateButtonPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

// Login with email
Given('Login with default credentials', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

// Verify create button options
And('User can see create button', () => {
	createButton.createButtonVisible();
});

When('User click on create button', () => {
	createButton.clickCreatebutton();
});

Then('User can verify all dropdown options', () => {
	createButton.verifyTextExist(CreateButtonData.income);
	createButton.verifyTextExist(CreateButtonData.expense);
	createButton.verifyTextExist(CreateButtonData.invoice);
	createButton.verifyTextExist(CreateButtonData.estimate);
	createButton.verifyTextExist(CreateButtonData.payment);
	createButton.verifyTextExist(CreateButtonData.timeLog);
	createButton.verifyTextExist(CreateButtonData.candidate);
	createButton.verifyTextExist(CreateButtonData.proposal);
	createButton.verifyTextExist(CreateButtonData.contract);
	createButton.verifyTextExist(CreateButtonData.team);
	createButton.verifyTextExist(CreateButtonData.task);
	createButton.verifyTextExist(CreateButtonData.contact);
	createButton.verifyTextExist(CreateButtonData.project);
	createButton.verifyTextExist(CreateButtonData.employee);
});

// Verify income card
When('User click on income dropdown option', () => {
	createButton.clickOptionByText(CreateButtonData.income);
});

Then('User can see income card', () => {
	createButton.verifyNbCardH5Header(CreateButtonData.incomeHeader);
});

And('User can se close button', () => {
	createButton.closeButtonVisible();
});

When('User click on close button', () => {
	createButton.clickCloseButton();
});

Then('User can see create button again', () => {
	createButton.createButtonVisible();
});

When('User click on create button', () => {
	createButton.clickCreatebutton();
});

// Verify expense card
Then('User can select expense from dropdown options', () => {
	createButton.clickOptionByText(CreateButtonData.expense);
});

And('User can see expense card', () => {
	createButton.verifyNbCardH4Header(CreateButtonData.expenseHeader);
});

And('User can se close button', () => {
	createButton.closeButtonVisible();
});

When('User click on close button', () => {
	createButton.clickCloseButton();
});

Then('User can see create button again', () => {
	createButton.createButtonVisible();
});

When('User click on create button', () => {
	createButton.clickCreatebutton();
});

// Verify invoice card
Then('User can select invoice from dropdown options', () => {
	createButton.clickOptionByText(CreateButtonData.invoice);
});

And('User can see invoice card', () => {
	createButton.verifyNbCardH4Header(CreateButtonData.invoiceHeader);
});

And('User can see create button again', () => {
	createButton.createButtonVisible();
});

When('User click on create button', () => {
	createButton.clickCreatebutton();
});

// Verify estimate card
Then('User can select estimate from dropdown options', () => {
	createButton.clickOptionByText(CreateButtonData.estimate);
});

And('User can see estimate card', () => {
	createButton.verifyNbCardH4Header(CreateButtonData.estimateHeader);
});

And('User can see create button again', () => {
	createButton.createButtonVisible();
});

When('User click on create button', () => {
	createButton.clickCreatebutton();
});

// Verify payment card
Then('User can select payment from dropdown options', () => {
	createButton.clickOptionByText(CreateButtonData.payment);
});

And('User can see payment card', () => {
	createButton.verifyNbCardH5Header(CreateButtonData.paymentHeader);
});

And('User can see cancel button', () => {
	createButton.cancelButtonVisible();
});

When('User click on cancel button', () => {
	createButton.clickCancelButton();
});

Then('User can see create button again', () => {
	createButton.createButtonVisible();
});

When('User click on create button', () => {
	createButton.clickCreatebutton();
});

// Verify time log card
Then('User can select time log from dropdown options', () => {
	createButton.clickOptionByText(CreateButtonData.timeLog);
});

And('User can see time log card', () => {
	createButton.verifyTimeLogHeaderText(CreateButtonData.timeLogHeader);
});

And('User can se close button', () => {
	createButton.closeButtonVisible();
});

When('User click on close button', () => {
	createButton.clickCloseButton();
});

Then('User can see create button again', () => {
	createButton.createButtonVisible();
});

When('User click on create button', () => {
	createButton.clickCreatebutton();
});

// Verify candidate card
Then('User can select candidate dropdown options', () => {
	createButton.clickOptionByText(CreateButtonData.candidate);
});

And('User can see candidate card', () => {
	createButton.verifyNbCardH5Header(CreateButtonData.candidateHeader);
});

And('User can se close button', () => {
	createButton.closeButtonVisible();
});

When('User click on close button', () => {
	createButton.clickCloseButton();
});

Then('User can see create button again', () => {
	createButton.createButtonVisible();
});

When('User click on create button', () => {
	createButton.clickCreatebutton();
});

// Verify proposal card
Then('User can select proposal from dropdown options', () => {
	createButton.clickOptionByText(CreateButtonData.proposal);
});

And('User can see proposal card', () => {
	createButton.verifyProposalHeaderText(CreateButtonData.proposalHeader);
});

And('User can see create button again', () => {
	createButton.createButtonVisible();
});

When('User click on create button', () => {
	createButton.clickCreatebutton();
});

// Verify contract card
Then('User can select contract from dropdown options', () => {
	createButton.clickOptionByText(CreateButtonData.contract);
});

And('User can see contract card', () => {
	createButton.verifyNbCardH5Header(CreateButtonData.contractHeader);
});

And('User can see create button again', () => {
	createButton.createButtonVisible();
});

When('User click on create button', () => {
	createButton.clickCreatebutton();
});

// Verify team card
Then('User can select team from dropdown options', () => {
	createButton.clickOptionByText(CreateButtonData.team);
});

And('User can see team card', () => {
	createButton.verifyDivH4Header(CreateButtonData.teamHeader);
});

And('User can see create button again', () => {
	createButton.createButtonVisible();
});

When('User click on create button', () => {
	createButton.clickCreatebutton();
});

// Verify task card
Then('User can select task dropdown options', () => {
	createButton.clickOptionByText(CreateButtonData.task);
});

And('User can see task card', () => {
	createButton.verifyNbCardH5Header(CreateButtonData.taskHeader);
});

And('User can se close button', () => {
	createButton.closeButtonVisible();
});

When('User click on close button', () => {
	createButton.clickCloseButton();
});

Then('User can see create button again', () => {
	createButton.createButtonVisible();
});

When('User click on create button', () => {
	createButton.clickCreatebutton();
});

// Verify contact card
Then('User can select contact from dropdown options', () => {
	createButton.clickOptionByText(CreateButtonData.contact);
});

And('User can see contact card', () => {
	createButton.verifyContactHeaderText(CreateButtonData.contactHeader);
});

And('User can see create button again', () => {
	createButton.createButtonVisible();
});

When('User click on create button', () => {
	createButton.clickCreatebutton();
});

// Verify project card
Then('User can select project from dropdown options', () => {
	createButton.clickOptionByText(CreateButtonData.project);
});

And('User can see project card', () => {
	createButton.verifyProjectHeaderText(CreateButtonData.projectHeader);
});

And('User can see create button again', () => {
	createButton.createButtonVisible();
});

When('User click on create button', () => {
	cy.on('uncaught:exception', (err, runnable) => {
		return false;
	});
	createButton.clickCreatebutton();
});

// Verify employee card
Then('User can select employee dropdown options', () => {
	createButton.clickOptionByText(CreateButtonData.task);
});

And('User can see employee card', () => {
	createButton.verifyNbCardH5Header(CreateButtonData.taskHeader);
});

And('User can se close button', () => {
	createButton.closeButtonVisible();
});

When('User click on close button', () => {
	createButton.clickCloseButton();
});

Then('User can see create button again', () => {
	createButton.createButtonVisible();
});
