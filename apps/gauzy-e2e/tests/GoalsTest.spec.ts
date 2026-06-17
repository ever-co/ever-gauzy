import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as goalsPage from './support/pages/Goals.po';
import { GoalsPageData } from '../src/support/Base/pagedata/GoalsPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

test.describe('Goals test', () => {
	test('Goals test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new goal', async () => {
			await getPage().goto('/#/pages/goals');
			// A hash-only goto() is a Playwright no-op when origin+path are unchanged, so the
			// SPA router can stay on the previous screen. Force the hash route explicitly.
			await getPage().evaluate(() => {
				if (!location.hash.includes('/pages/goals')) {
					location.hash = '#/pages/goals';
				}
			});
			await goalsPage.addButtonVisible();
			await goalsPage.clickAddButton(0);
			await goalsPage.selectOptionFromDropdown(0);
			await goalsPage.nameInputVisible();
			await goalsPage.enterNameInputData(GoalsPageData.name);
			await goalsPage.ownerDropdownVisible();
			await goalsPage.clickOwnerDropdown();
			await goalsPage.selectOwnerFromDropdown(GoalsPageData.owner);
			await goalsPage.leadDropdownVisible();
			await goalsPage.clickLeadDropdown();
			await goalsPage.selectLeadFromDropdown(0);
			await goalsPage.confirmButtonVisible();
			await goalsPage.clickConfirmButton();
			await goalsPage.waitMessageToHide();
			await goalsPage.verifyGoalExists(GoalsPageData.name);
		});

		await test.step('Should be able to add key result', async () => {
			await goalsPage.tableRowVisible();
			await goalsPage.clickTableRow(0);
			await goalsPage.addButtonVisible();
			await goalsPage.clickAddButton(1);
			await goalsPage.keyResultInputVisible();
			await goalsPage.enterKeyResultNameData(GoalsPageData.keyResultName);
			await goalsPage.keyResultOwnerDropdownVisible();
			await goalsPage.clickKeyResultOwnerDropdown();
			await goalsPage.selectKeyResultOwnerFromDropdown(0);
			await goalsPage.keyResultLeadDropdownVisible();
			await goalsPage.clickKeyResultLeadDropdown();
			await goalsPage.selectKeyResultLeadFromDropdown(0);
			await goalsPage.toggleButtonVisible();
			await goalsPage.clickToggleButton();
			await goalsPage.clickToggleButton();
			await goalsPage.confirmButtonVisible();
			await goalsPage.clickConfirmButton();
		});

		await test.step('Should be able to add new deadline', async () => {
			await goalsPage.waitMessageToHide();
			await goalsPage.clickTableRow(0);
			await goalsPage.viewButtonVisible();
			await goalsPage.clickViewButton(1);
			await goalsPage.addNewDeadlineButtonVisible();
			await goalsPage.clickAddDeadlineButton();
			await goalsPage.updatedValueInputVisible();
			await goalsPage.enterUpdatedValueData(1);
			await goalsPage.confirmButtonVisible();
			await goalsPage.clickConfirmButton();
			await goalsPage.saveDeadlineButtonVisible();
			await goalsPage.clickSaveDeadlineButton();
		});

		await test.step('Should be able to add weight parameter', async () => {
			await goalsPage.waitMessageToHide();
			await goalsPage.progressBarVisible();
			await goalsPage.clickProgressBar(0);
			await goalsPage.weightTypeButtonVisible();
			await goalsPage.clickWeightTypeButton(0);
			await goalsPage.weightParameterDropdownVisible();
			await goalsPage.clickWeightParameterDropdown();
			await goalsPage.selectWeightParameterFromDropdown(GoalsPageData.weightParameter);
			await goalsPage.confirmButtonVisible();
			await goalsPage.clickConfirmButton();
		});

		await test.step('Should be able to edit goal', async () => {
			await goalsPage.waitMessageToHide();
			await goalsPage.editButtonVisible();
			await goalsPage.clickEditButton(0);
			await goalsPage.ownerDropdownVisible();
			await goalsPage.clickOwnerDropdown();
			await goalsPage.selectOwnerFromDropdown(GoalsPageData.owner);
			await goalsPage.confirmButtonVisible();
			await goalsPage.clickConfirmButton();
		});

		await test.step('Should be able to delete goal', async () => {
			await goalsPage.waitMessageToHide();
			await goalsPage.viewButtonVisible();
			await goalsPage.clickViewButton(0);
			await goalsPage.deleteButtonVisible();
			await goalsPage.clickDeleteButton();
			await goalsPage.confirmButtonVisible();
			await goalsPage.clickConfirmButton();
			await goalsPage.waitMessageToHide();
			await getPage().reload();
			await CustomCommands.login(loginPage, LoginPageData, dashboardPage);
			await getPage().goto('/#/pages/goals');
			await goalsPage.verifyElementIsDeleted();
		});
	});
});
