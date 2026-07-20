import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as organizationProjectsPage from '../../support/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../../../src/support/Base/pagedata/OrganizationProjectsPageData';

// Converted 1:1 from the plain OrganizationProjectsTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence (verification folded in), so
// runtime behaviour is identical to the already-CI-tested spec. The `Given I am logged in as the default
// user` Background step is defined once in common.steps.ts.

When('I add a new project', async () => {
	await getPage().goto('/#/pages/organization/projects');
	await organizationProjectsPage.gridBtnExists();
	await organizationProjectsPage.gridBtnClick(1);
	await organizationProjectsPage.requestProjectButtonVisible();
	await organizationProjectsPage.clickRequestProjectButton();
	await organizationProjectsPage.nameInputVisible();
	await organizationProjectsPage.enterNameInputData(
		OrganizationProjectsPageData.name
	);
	await organizationProjectsPage.selectEmployeeDropdownVisible();
	await organizationProjectsPage.clickSelectEmployeeDropdown();
	await organizationProjectsPage.selectEmployeeDropdownOption(0);
	await organizationProjectsPage.clickKeyboardButtonByKeyCode(9);
	await organizationProjectsPage.clickTabButton(1);
	await organizationProjectsPage.tagsMultiSelectVisible();
	await organizationProjectsPage.clickTagsMultiSelect();
	await organizationProjectsPage.selectTagsFromDropdown(0);
	await organizationProjectsPage.clickCardBody();
	await organizationProjectsPage.clickTabButton(3);
	await organizationProjectsPage.budgetHoursInputVisible();
	await organizationProjectsPage.enterBudgetHoursInputData(
		OrganizationProjectsPageData.hours
	);
	await organizationProjectsPage.clickTabButton(5);
	await organizationProjectsPage.colorInputVisible();
	await organizationProjectsPage.enterColorInputData(
		OrganizationProjectsPageData.color
	);
	await organizationProjectsPage.saveProjectButtonVisible();
	await organizationProjectsPage.clickSaveProjectButton();
	await organizationProjectsPage.waitMessageToHide();
	await organizationProjectsPage.verifyProjectExists(
		OrganizationProjectsPageData.name
	);
});

When('I edit the project', async () => {
	await organizationProjectsPage.tableRowVisible();
	await organizationProjectsPage.selectTableRow(0);
	await organizationProjectsPage.editButtonVisible();
	await organizationProjectsPage.clickEditButton();
	await organizationProjectsPage.nameInputVisible();
	await organizationProjectsPage.enterNameInputData(
		OrganizationProjectsPageData.editName
	);
	await organizationProjectsPage.clickTabButton(3);
	await organizationProjectsPage.budgetHoursInputVisible();
	await organizationProjectsPage.enterBudgetHoursInputData(
		OrganizationProjectsPageData.hours
	);
	await organizationProjectsPage.clickTabButton(5);
	await organizationProjectsPage.colorInputVisible();
	await organizationProjectsPage.enterColorInputData(
		OrganizationProjectsPageData.color
	);
	await organizationProjectsPage.saveProjectButtonVisible();
	await organizationProjectsPage.clickSaveProjectButton();
});

When('I delete the project', async () => {
	await organizationProjectsPage.waitMessageToHide();
	await organizationProjectsPage.selectTableRow(0);
	await organizationProjectsPage.deleteButtonVisible();
	await organizationProjectsPage.clickDeleteButton();
	await organizationProjectsPage.confirmDeleteButtonVisible();
	await organizationProjectsPage.clickConfirmDeleteButton();
	await organizationProjectsPage.waitMessageToHide();
	await organizationProjectsPage.verifyProjectIsDeleted(
		OrganizationProjectsPageData.editName
	);
});
