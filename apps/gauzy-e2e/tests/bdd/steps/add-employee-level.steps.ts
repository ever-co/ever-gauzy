import { When } from '../../support/bdd';
import * as addEmployeeLevelPage from '../../support/pages/AddEmployeeLevel.po';
import { AddEmployeeLevelPageData } from '../../../src/support/Base/pagedata/AddEmployeeLevelPageData';
import * as organizationTagsUserPage from '../../support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../../src/support/Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from '../../support/commands';

// Converted 1:1 from the plain AddEmployeeLevelTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence, so runtime behaviour is
// identical to the already-CI-tested spec. The `Given I am logged in as the default user` Background
// step is defined once in common.steps.ts.

When('I add a new employee level', async () => {
	await CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
	// addTag ends on /#/pages/organization/tags; a bare goto to the level hash is a same-document
	// no-op there, so force the hash + settle (see navigateToEmployeeLevel).
	await addEmployeeLevelPage.navigateToEmployeeLevel();
	await addEmployeeLevelPage.gridBtnExists();
	await addEmployeeLevelPage.gridBtnClick(1);
	await addEmployeeLevelPage.addNewLevelButtonVisible();
	await addEmployeeLevelPage.clickAddNewLevelButton();
	await addEmployeeLevelPage.newLevelInputVisible();
	await addEmployeeLevelPage.enterNewLevelData(AddEmployeeLevelPageData.levelE);
	await addEmployeeLevelPage.tagsMultiSelectVisible();
	await addEmployeeLevelPage.clickTagsMultiSelect();
	await addEmployeeLevelPage.selectTagsFromDropdown(0);
	await addEmployeeLevelPage.clickKeyboardButtonByKeyCode(9);
	await addEmployeeLevelPage.saveNewLevelButtonVisible();
	await addEmployeeLevelPage.clickSaveNewLevelButton();
	await addEmployeeLevelPage.waitMessageToHide();
	// Edit is disabled until a grid row is selected (selectEmployee enables it).
	await addEmployeeLevelPage.selectEmployeeLevelRow();
	await addEmployeeLevelPage.editEmployeeLevelButtonVisible();
	await addEmployeeLevelPage.clickEditEmployeeLevelButton();
	await addEmployeeLevelPage.verifyTitleExists(AddEmployeeLevelPageData.levelE);
	await addEmployeeLevelPage.cancelButtonVisible();
	await addEmployeeLevelPage.clickCancelButton();
});

When('I edit the employee level', async () => {
	// Cancel reset disabled=true, so re-select the row to re-enable Edit.
	await addEmployeeLevelPage.selectEmployeeLevelRow();
	await addEmployeeLevelPage.editEmployeeLevelButtonVisible();
	await addEmployeeLevelPage.clickEditEmployeeLevelButton();
	await addEmployeeLevelPage.editEmployeeLevelInpuVisible();
	await addEmployeeLevelPage.enterEditLevelData(AddEmployeeLevelPageData.levelF);
	await addEmployeeLevelPage.tagsMultiSelectVisible();
	await addEmployeeLevelPage.clickTagsMultiSelect();
	await addEmployeeLevelPage.selectTagsFromDropdown(0);
	await addEmployeeLevelPage.clickKeyboardButtonByKeyCode(9);
	await addEmployeeLevelPage.saveNewLevelButtonVisible();
	await addEmployeeLevelPage.clickSaveNewLevelButton();
	await addEmployeeLevelPage.waitMessageToHide();
	await addEmployeeLevelPage.selectEmployeeLevelRow();
	await addEmployeeLevelPage.editEmployeeLevelButtonVisible();
	await addEmployeeLevelPage.clickEditEmployeeLevelButton();
	await addEmployeeLevelPage.verifyTitleExists(AddEmployeeLevelPageData.levelF);
	await addEmployeeLevelPage.cancelButtonVisible();
	await addEmployeeLevelPage.clickCancelButton();
});

When('I delete the employee level', async () => {
	await addEmployeeLevelPage.addNewLevelButtonVisible();
	await addEmployeeLevelPage.clickAddNewLevelButton();
	await addEmployeeLevelPage.newLevelInputVisible();
	await addEmployeeLevelPage.enterNewLevelData(AddEmployeeLevelPageData.levelE);
	await addEmployeeLevelPage.tagsMultiSelectVisible();
	await addEmployeeLevelPage.clickTagsMultiSelect();
	await addEmployeeLevelPage.selectTagsFromDropdown(0);
	await addEmployeeLevelPage.clickKeyboardButtonByKeyCode(9);
	await addEmployeeLevelPage.saveNewLevelButtonVisible();
	await addEmployeeLevelPage.clickSaveNewLevelButton();
	await addEmployeeLevelPage.waitMessageToHide();
	// removeEmployeeLevel deletes the SELECTED row, so select the just-added Level E first.
	await addEmployeeLevelPage.selectEmployeeLevelRowByText(AddEmployeeLevelPageData.levelE);
	await addEmployeeLevelPage.deleteLevelButtonVisible();
	await addEmployeeLevelPage.clickDeleteLevelButton();
	await addEmployeeLevelPage.confirmDeleteButtonVisible();
	await addEmployeeLevelPage.clickConfirmDeleteLevelButton();
	await addEmployeeLevelPage.verifyElementIsDeleted(AddEmployeeLevelPageData.levelE);
	await addEmployeeLevelPage.waitMessageToHide();
	// Remove the remaining row (Level F, carried over from the edit step) to leave a clean grid.
	await addEmployeeLevelPage.selectEmployeeLevelRowByText(AddEmployeeLevelPageData.levelF);
	await addEmployeeLevelPage.deleteLevelButtonVisible();
	await addEmployeeLevelPage.clickDeleteLevelButton();
	await addEmployeeLevelPage.confirmDeleteButtonVisible();
	await addEmployeeLevelPage.clickConfirmDeleteLevelButton();
});
