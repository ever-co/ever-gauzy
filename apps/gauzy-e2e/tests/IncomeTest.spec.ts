import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as incomePage from './support/pages/Income.po';
import { faker } from '@faker-js/faker';
import { IncomePageData } from '../src/support/Base/pagedata/IncomePageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import * as organizationTagsUserPage from './support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../src/support/Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from './support/commands';

let name = ' ';

test.describe('Income test', () => {
	test('Income test', async () => {
		name = faker.person.firstName();

		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new income', async () => {
			await CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
			await getPage().goto('/#/pages/accounting/income');
			await incomePage.gridBtnExists();
			await incomePage.gridBtnClick(1);
			await incomePage.addIncomeButtonVisible();
			await incomePage.clickAddIncomeButton();
			await incomePage.selectEmployeeDropdownVisible();
			await incomePage.clickEmployeeDropdown();
			await incomePage.selectEmployeeFromDropdown(0);
			await incomePage.dateInputVisible();
			await incomePage.enterDateInputData();
			await incomePage.clickKeyboardButtonByKeyCode(9);
			await incomePage.contactInputVisible();
			await incomePage.enterContactInputData(name);
			await incomePage.amountInputVisible();
			await incomePage.enterAmountInputData(IncomePageData.defaultAmount);
			await incomePage.tagsDropdownVisible();
			await incomePage.clickTagsDropdown();
			await incomePage.selectTagFromDropdown(0);
			await incomePage.clickCardBody();
			await incomePage.notesTextareaVisible();
			await incomePage.enterNotesInputData(IncomePageData.defaultNote);
			await incomePage.saveIncomeButtonVisible();
			await incomePage.clickSaveIncomeButton();
			await incomePage.waitMessageToHide();
			// Scope verify/select/delete to the UNIQUE faker contact `name` (its client column), never the
			// shared static note or row 0 — the suite shares one seeded DB serially, so earlier specs leave
			// income rows behind and an index/static-text match would target the WRONG record.
			await incomePage.verifyIncomeExists(name);
		});

		await test.step('Should be able to edit income', async () => {
			await incomePage.selectTableRow(name);
			await incomePage.editIncomeButtonVisible();
			await incomePage.clickEditIncomeButton();
			await incomePage.dateInputVisible();
			await incomePage.enterDateInputData();
			await incomePage.clickKeyboardButtonByKeyCode(9);
			await incomePage.contactInputVisible();
			await incomePage.enterContactInputData(name);
			await incomePage.amountInputVisible();
			await incomePage.enterAmountInputData(IncomePageData.defaultAmount);
			await incomePage.notesTextareaVisible();
			await incomePage.enterNotesInputData(IncomePageData.defaultNote);
			await incomePage.saveIncomeButtonVisible();
			await incomePage.clickSaveIncomeButton();
			await incomePage.waitMessageToHide();
			await incomePage.verifyIncomeExists(name);
		});

		await test.step('Should be able to delete income', async () => {
			await incomePage.selectTableRow(name);
			await incomePage.deleteIncomeButtonVisible();
			await incomePage.clickDeleteIncomeButton();
			await incomePage.confirmDeleteButtonVisible();
			await incomePage.clickConfirmDeleteButton();
			await incomePage.waitMessageToHide();
			await incomePage.verifyElementIsDeleted(name);
		});
	});
});
