import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as createButton from '../support/Base/pages/CreateButton.po';
import { CreateButtonData } from '../support/Base/pagedata/CreateButtonPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

describe('Create button test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});

	it('Should able to verify text exist', () => {
		createButton.createButtonVisible();
		createButton.clickCreatebutton();
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
	it('Should able to verify income card', () => {
		createButton.clickOptionByText(CreateButtonData.income);
		createButton.verifyNbCardH5Header(CreateButtonData.incomeHeader);
		createButton.closeButtonVisible();
		createButton.clickCloseButton();
		createButton.createButtonVisible();
		createButton.clickCreatebutton();
	});
	it('Should able to verify expense card', () => {
		createButton.clickOptionByText(CreateButtonData.expense);
		createButton.verifyNbCardH4Header(CreateButtonData.expenseHeader);
		createButton.closeButtonVisible();
		createButton.clickCloseButton();
		createButton.createButtonVisible();
		createButton.clickCreatebutton();
	});
	it('Should able to verify invoice card', () => {
		createButton.clickOptionByText(CreateButtonData.invoice);
		createButton.verifyNbCardH4Header(CreateButtonData.invoiceHeader);
		createButton.createButtonVisible();
		createButton.clickCreatebutton();
	});
	it('Should able to verify estimate card', () => {
		createButton.clickOptionByText(CreateButtonData.estimate);
		createButton.verifyNbCardH4Header(CreateButtonData.estimateHeader);
		createButton.createButtonVisible();
		createButton.clickCreatebutton();
	});
	it('Should able to verify payment card', () => {
		createButton.clickOptionByText(CreateButtonData.payment);
		createButton.verifyNbCardH5Header(CreateButtonData.paymentHeader);
		createButton.cancelButtonVisible();
		createButton.clickCancelButton();
		createButton.createButtonVisible();
		createButton.clickCreatebutton();
	});
	it('Should able to verify time log card', () => {
		createButton.clickOptionByText(CreateButtonData.timeLog);
		createButton.verifyTimeLogHeaderText(CreateButtonData.timeLogHeader);
		createButton.closeButtonVisible();
		createButton.clickCloseButton();
		createButton.createButtonVisible();
		createButton.clickCreatebutton();
	});
	it('Should able to verify candidate card', () => {
		createButton.clickOptionByText(CreateButtonData.candidate);
		createButton.verifyNbCardH5Header(CreateButtonData.candidateHeader);
		createButton.closeButtonVisible();
		createButton.clickCloseButton();
		createButton.createButtonVisible();
		createButton.clickCreatebutton();
	});
	it('Should able to verify proposal card', () => {
		createButton.clickOptionByText(CreateButtonData.proposal);
		createButton.verifyProposalHeaderText(CreateButtonData.proposalHeader);
		createButton.createButtonVisible();
		createButton.clickCreatebutton();
	});
	it('Should able to verify contract card', () => {
		createButton.clickOptionByText(CreateButtonData.contract);
		createButton.verifyNbCardH5Header(CreateButtonData.contractHeader);
		createButton.createButtonVisible();
		createButton.clickCreatebutton();
	});
	it('Should able to verify team card', () => {
		createButton.clickOptionByText(CreateButtonData.team);
		createButton.verifyDivH4Header(CreateButtonData.teamHeader);
		createButton.createButtonVisible();
		createButton.clickCreatebutton();
	});
	it('Should able to verify task card', () => {
		createButton.clickOptionByText(CreateButtonData.task);
		createButton.verifyNbCardH5Header(CreateButtonData.taskHeader);
		createButton.closeButtonVisible();
		createButton.clickCloseButton();
		createButton.createButtonVisible();
		createButton.clickCreatebutton();
	});
	it('Should able to verify contact card', () => {
		createButton.clickOptionByText(CreateButtonData.contact);
		createButton.verifyContactHeaderText(CreateButtonData.contactHeader);
		createButton.createButtonVisible();
		createButton.clickCreatebutton();
	});
	it('Should able to verify project card', () => {
		createButton.clickOptionByText(CreateButtonData.project);
		createButton.verifyDivH4Header(CreateButtonData.projectHeader);
		createButton.createButtonVisible();
		createButton.clickCreatebutton();
	});
	it('Should able to verify employee card', () => {
		createButton.clickOptionByText(CreateButtonData.employee);
		createButton.verifyNbCardH5Header(CreateButtonData.employeeHeader);
		createButton.closeButtonVisible();
		createButton.clickCloseButton();
		createButton.createButtonVisible();
	});
});
