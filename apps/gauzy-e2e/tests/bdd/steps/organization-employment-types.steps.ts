import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as organizationEmploymentTypePage from '../../support/pages/OrganizationEmploymentTypes.po';
import { OrganizationEmploymentTypesPageData } from '../../../src/support/Base/pagedata/OrganizationEmploymentTypesPageData';

// Converted 1:1 from the plain OrganizationEmploymentTypesTest.spec.ts: the single test() -> one
// Scenario, each test.step() -> one When step whose body is the verbatim .po call sequence
// (verification folded in), so runtime behaviour is identical to the already-CI-tested spec. The
// `Given I am logged in as the default user` Background step is defined once in common.steps.ts.

When('I add a new employment type', async () => {
	// The previous CustomCommands.addTag prerequisite (a shared command this spec cannot edit) was
	// removed: it flakily failed at its own Add-dialog open (the coordinate-force click landed on a
	// leftover cdk-overlay backdrop, so #inputName never appeared), and it is NOT needed here — the
	// default org seed always provides tags (DEFAULT_GLOBAL_TAGS: VIP/Urgent/… 12 tags) in the
	// employment-type #addTags ng-select, and selectTagFromDropdown is best-effort anyway. Navigate
	// straight to the feature from the post-login dashboard.
	// Force-hash bounce (mirror gotoRoute in commands.ts): a bare hash goto() right after login can be
	// a same-document no-op, leaving the SPA on the dashboard so the feature's first control is never
	// found. Force the hash then wait for the employment-types card header before interacting.
	await getPage().goto('/#/pages/organization/employment-types');
	await getPage().evaluate(() => {
		if (!location.hash.includes('/pages/organization/employment-types')) {
			location.hash = '#/pages/organization/employment-types';
		}
	});
	await getPage().waitForTimeout(800);
	await getPage()
		.locator('ngx-header-title')
		.first()
		.waitFor({ state: 'visible', timeout: 30000 })
		.catch(() => {});
	await organizationEmploymentTypePage.gridBtnExists();
	await organizationEmploymentTypePage.gridBtnClick(1);
	await organizationEmploymentTypePage.addButtonVisible();
	await organizationEmploymentTypePage.clickAddButton();
	await organizationEmploymentTypePage.nameInputVisible();
	await organizationEmploymentTypePage.enterNameInputData(
		OrganizationEmploymentTypesPageData.name
	);
	await organizationEmploymentTypePage.tagsDropdownVisible();
	await organizationEmploymentTypePage.clickTagsDropdown();
	await organizationEmploymentTypePage.selectTagFromDropdown(0);
	await organizationEmploymentTypePage.clickKeyboardButtonByKeyCode(9);
	await organizationEmploymentTypePage.saveButtonVisible();
	await organizationEmploymentTypePage.clickSaveButton();
	await organizationEmploymentTypePage.waitMessageToHide();
	await organizationEmploymentTypePage.verifyTypeExists(
		OrganizationEmploymentTypesPageData.name
	);
});

When('I edit the employment type', async () => {
	// Scope the row selection to OUR record (pollution resilience — the shared serial run
	// accumulates employment-type cards).
	await organizationEmploymentTypePage.selectFirstItem(
		OrganizationEmploymentTypesPageData.name
	);
	await organizationEmploymentTypePage.editButtonVisible();
	await organizationEmploymentTypePage.clickEditButton(0);
	await organizationEmploymentTypePage.saveButtonVisible();
	await organizationEmploymentTypePage.clickSaveButton();
});

When('I delete the employment type', async () => {
	await organizationEmploymentTypePage.waitMessageToHide();
	// Scope to OUR record so the delete targets the type this spec created, not a polluted card.
	await organizationEmploymentTypePage.selectFirstItem(
		OrganizationEmploymentTypesPageData.name
	);
	await organizationEmploymentTypePage.deleteButtonVisible();
	await organizationEmploymentTypePage.clickDeleteButton(0);
	await organizationEmploymentTypePage.confirmDeleteButtonVisible();
	await organizationEmploymentTypePage.clickConfirmDeleteButton();
	await organizationEmploymentTypePage.waitMessageToHide();
	await organizationEmploymentTypePage.verifyTypeIsDeleted(OrganizationEmploymentTypesPageData.name);
});
