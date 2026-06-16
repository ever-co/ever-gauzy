import { test } from './support/fixtures';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as createButton from './support/pages/CreateButton.po';
import { CreateButtonData } from '../src/support/Base/pagedata/CreateButtonPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

test.describe('Create button test', () => {
	test('Create button test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should able to verify text exist', async () => {
			await createButton.createButtonVisible();
			await createButton.clickCreateButton();
			await createButton.verifyTextExist(CreateButtonData.income);
			await createButton.verifyTextExist(CreateButtonData.expense);
			await createButton.verifyTextExist(CreateButtonData.invoice);
			await createButton.verifyTextExist(CreateButtonData.estimate);
			await createButton.verifyTextExist(CreateButtonData.payment);
			await createButton.verifyTextExist(CreateButtonData.timeLog);
			await createButton.verifyTextExist(CreateButtonData.candidate);
			await createButton.verifyTextExist(CreateButtonData.proposal);
			await createButton.verifyTextExist(CreateButtonData.contract);
			await createButton.verifyTextExist(CreateButtonData.team);
			await createButton.verifyTextExist(CreateButtonData.task);
			await createButton.verifyTextExist(CreateButtonData.contact);
			await createButton.verifyTextExist(CreateButtonData.project);
			await createButton.verifyTextExist(CreateButtonData.employee);
		});

		await test.step('Should able to verify income card', async () => {
			await createButton.clickOptionByText(CreateButtonData.income);
			await createButton.verifyNbCardH5Header(CreateButtonData.incomeHeader);
			await createButton.closeButtonVisible();
			await createButton.clickCloseButton();
			await createButton.createButtonVisible();
			await createButton.clickCreateButton();
		});

		await test.step('Should able to verify expense card', async () => {
			await createButton.clickOptionByText(CreateButtonData.expense);
			await createButton.verifyNbCardH4Header(CreateButtonData.expenseHeader);
			await createButton.closeButtonVisible();
			await createButton.clickCloseButton();
			await createButton.createButtonVisible();
			await createButton.clickCreateButton();
		});

		await test.step('Should able to verify invoice card', async () => {
			await createButton.clickOptionByText(CreateButtonData.invoice);
			await createButton.verifyNbCardH4Header(CreateButtonData.invoiceHeader);
			await createButton.createButtonVisible();
			await createButton.clickCreateButton();
		});

		await test.step('Should able to verify estimate card', async () => {
			await createButton.clickOptionByText(CreateButtonData.estimate);
			await createButton.verifyNbCardH4Header(CreateButtonData.estimateHeader);
			await createButton.createButtonVisible();
			await createButton.clickCreateButton();
		});

		await test.step('Should able to verify payment card', async () => {
			await createButton.clickOptionByText(CreateButtonData.payment);
			await createButton.verifyNbCardH5Header(CreateButtonData.paymentHeader);
			await createButton.cancelButtonVisible();
			await createButton.clickCancelButton();
			await createButton.createButtonVisible();
			await createButton.clickCreateButton();
		});

		await test.step('Should able to verify time log card', async () => {
			await createButton.clickOptionByText(CreateButtonData.timeLog);
			await createButton.verifyTimeLogHeaderText(CreateButtonData.timeLogHeader);
			await createButton.closeButtonVisible();
			await createButton.clickCloseButton();
			await createButton.createButtonVisible();
			await createButton.clickCreateButton();
		});

		await test.step('Should able to verify candidate card', async () => {
			await createButton.clickOptionByText(CreateButtonData.candidate);
			await createButton.verifyNbCardH5Header(CreateButtonData.candidateHeader);
			await createButton.closeButtonVisible();
			await createButton.clickCloseButton();
			await createButton.createButtonVisible();
			await createButton.clickCreateButton();
		});

		await test.step('Should able to verify proposal card', async () => {
			await createButton.clickOptionByText(CreateButtonData.proposal);
			await createButton.verifyProposalHeaderText(CreateButtonData.proposalHeader);
			await createButton.createButtonVisible();
			await createButton.clickCreateButton();
		});

		await test.step('Should able to verify contract card', async () => {
			await createButton.clickOptionByText(CreateButtonData.contract);
			await createButton.verifyNbCardH5Header(CreateButtonData.contractHeader);
			await createButton.createButtonVisible();
			await createButton.clickCreateButton();
		});

		await test.step('Should able to verify team card', async () => {
			await createButton.clickOptionByText(CreateButtonData.team);
			await createButton.verifyDivH4Header(CreateButtonData.teamHeader);
			await createButton.createButtonVisible();
			await createButton.clickCreateButton();
		});

		await test.step('Should able to verify task card', async () => {
			await createButton.clickOptionByText(CreateButtonData.task);
			await createButton.verifyNbCardH5Header(CreateButtonData.taskHeader);
			await createButton.closeButtonVisible();
			await createButton.clickCloseButton();
			await createButton.createButtonVisible();
			await createButton.clickCreateButton();
		});

		await test.step('Should able to verify contact card', async () => {
			await createButton.clickOptionByText(CreateButtonData.contact);
			await createButton.verifyContactHeaderText(CreateButtonData.contactHeader);
			await createButton.createButtonVisible();
			await createButton.clickCreateButton();
		});

		await test.step('Should able to verify project card', async () => {
			await createButton.clickOptionByText(CreateButtonData.project);
			await createButton.verifyDivH4Header(CreateButtonData.projectHeader);
			await createButton.createButtonVisible();
			await createButton.clickCreateButton();
		});

		await test.step('Should able to verify employee card', async () => {
			await createButton.clickOptionByText(CreateButtonData.employee);
			await createButton.verifyNbCardH5Header(CreateButtonData.employeeHeader);
			await createButton.closeButtonVisible();
			await createButton.clickCloseButton();
			await createButton.createButtonVisible();
		});
	});
});
