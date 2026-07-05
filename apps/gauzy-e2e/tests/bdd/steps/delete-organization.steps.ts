import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as deleteOrganizationPage from '../../support/pages/DeleteOrganization.po';

// Converted 1:1 from the plain DeleteOrganizationTest.spec.ts: the single test() -> one Scenario, its
// lone test.step() -> one When step whose body is the verbatim .po call sequence, so runtime behaviour
// is identical to the already-CI-tested spec. The `Given I am logged in as the default user` Background
// step is defined once in common.steps.ts.

When('I delete an organization', async () => {
	await getPage().goto('/#/pages/organizations');
	await deleteOrganizationPage.gridBtnExists();
	await deleteOrganizationPage.gridBtnClick();
	await deleteOrganizationPage.deleteBtnExists();
	// Selecting a row enables the (otherwise disabled) toolbar Delete button; deleteBtnClick
	// also selects internally, but make the prerequisite explicit in the flow.
	await deleteOrganizationPage.selectOrganization(0);
	await deleteOrganizationPage.deleteBtnClick();
	await deleteOrganizationPage.confirmBtnExists();
	await deleteOrganizationPage.confirmBtnClick();
});
