import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as organizationTeamsPage from '../../support/pages/OrganizationTeams.po';
import { OrganizationTeamsPageData } from '../../../src/support/Base/pagedata/OrganizationTeamsPageData';
import * as organizationTagsUserPage from '../../support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../../src/support/Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from '../../support/commands';
import { faker } from '@faker-js/faker';

// Converted 1:1 from the plain OrganizationTeamsTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence (verification folded in),
// so runtime behaviour is identical to the already-CI-tested spec. The `Given I am logged in as the
// default user` Background step is defined once in common.steps.ts.


// RUN-UNIQUE team names. The API rejects a duplicate name with 400 "The team name X is already in use",
// and teams.component swallows that in a bare catch, so with the old FIXED names the very first run to
// leave a team behind poisoned every later run: the create silently failed, the dialog stayed open, and
// verifyTeamExists still passed — on the LEFTOVER row. The spec only fell over two steps later, on a
// second stacked dialog. Unique-per-run names (the pattern the rest of the suite already uses, see
// clients.steps.ts) make the create succeed and make every assertion below refer to THIS run's record.
// Initialised at the very start of the first step, and shared across steps at module scope.
let teamName = OrganizationTeamsPageData.name;
let editTeamName = OrganizationTeamsPageData.editName;

When('I add a new team', async () => {
	const suffix = faker.string.alphanumeric(6);
	teamName = `${OrganizationTeamsPageData.name} ${suffix}`;
	editTeamName = `${OrganizationTeamsPageData.editName} ${suffix}`;

	await CustomCommands.addTag(
		organizationTagsUserPage,
		OrganizationTagsPageData
	);
	// addTag ends on /#/pages/organization/tags and can leave a lingering (or re-opened, empty)
	// "Add Tags" nb-dialog + cdk backdrop mounted (its detach is best-effort/swallowed). A bare
	// goto to teams is then a same-document hash no-op AND its backdrop blocks the toolbar "Add",
	// so ga-teams-mutation never opens (the "Team Name" input is never found). Dismiss any leftover
	// tags dialog first, then force the hash route and wait for the Teams card to render.
	const page = getPage();
	for (let i = 0; i < 3 && (await page.locator('ngx-tags-mutation').count()) > 0; i++) {
		await page.keyboard.press('Escape').catch(() => undefined);
		await page.locator('ngx-tags-mutation').first().waitFor({ state: 'detached', timeout: 4000 }).catch(() => undefined);
	}
	await page.goto('/#/pages/organization/teams');
	await page.evaluate(() => {
		if (!location.hash.includes('/pages/organization/teams')) {
			location.hash = '#/pages/organization/teams';
		}
	});
	await page.waitForTimeout(800);
	// Wait for the Teams screen's own card header before interacting (not the tags page).
	await page
		.locator('ngx-header-title:has-text("Teams"), h4:has-text("Teams")')
		.first()
		.waitFor({ state: 'visible', timeout: 30000 })
		.catch(() => undefined);
	await organizationTeamsPage.gridBtnExists();
	await organizationTeamsPage.gridBtnClick(1);
	await organizationTeamsPage.addTeamButtonVisible();
	await organizationTeamsPage.clickAddTeamButton();
	await organizationTeamsPage.nameInputVisible();
	await organizationTeamsPage.enterNameInputData(
		teamName
	);
	await organizationTeamsPage.tagsMultiSelectVisible();
	await organizationTeamsPage.clickTagsMultiSelect();
	await organizationTeamsPage.selectTagsFromDropdown(0);
	await organizationTeamsPage.clickCardBody(0);
	await organizationTeamsPage.clickEmployeeDropdown(1);
	await organizationTeamsPage.selectEmployeeFromDropdown(0);
	await organizationTeamsPage.clickCardBody(0);
	await organizationTeamsPage.clickManagerDropdown(1);
	await organizationTeamsPage.selectManagerFromDropdown(0);
	await organizationTeamsPage.clickCardBody(0);
	await organizationTeamsPage.saveButtonVisible();
	await organizationTeamsPage.clickSaveButton();
	await organizationTeamsPage.waitMessageToHide();
	await organizationTeamsPage.verifyTeamExists(teamName);
});

When('I edit the team', async () => {
	await organizationTeamsPage.tableRowVisible();
	// Scope to the team we just created (not the seeded "Default" team) — the grid is shared across
	// the serial suite, so a plain row-0 pick can select the wrong record.
	await organizationTeamsPage.selectTableRow(teamName);
	await organizationTeamsPage.editButtonVisible();
	await organizationTeamsPage.clickEditButton();
	await organizationTeamsPage.nameInputVisible();
	await organizationTeamsPage.enterNameInputData(
		editTeamName
	);
	await organizationTeamsPage.tagsMultiSelectVisible();
	await organizationTeamsPage.clickTagsMultiSelect();
	await organizationTeamsPage.selectTagsFromDropdown(0);
	await organizationTeamsPage.clickCardBody(0);
	await organizationTeamsPage.clickEmployeeDropdown(1);
	await organizationTeamsPage.selectEmployeeFromDropdown(0);
	await organizationTeamsPage.clickCardBody(0);
	await organizationTeamsPage.clickManagerDropdown(1);
	await organizationTeamsPage.selectManagerFromDropdown(0);
	await organizationTeamsPage.clickCardBody(0);
	await organizationTeamsPage.saveButtonVisible();
	await organizationTeamsPage.clickSaveButton();
	await organizationTeamsPage.waitMessageToHide();
	await organizationTeamsPage.verifyTeamExists(
		editTeamName
	);
});

When('I delete the team', async () => {
	// After the rename the row is now under editName — scope to it (not the seeded "Default" team).
	await organizationTeamsPage.selectTableRow(editTeamName);
	await organizationTeamsPage.deleteButtonVisible();
	await organizationTeamsPage.clickDeleteButton();
	await organizationTeamsPage.confirmDeleteButtonVisible();
	await organizationTeamsPage.clickConfirmDeleteButton();
	await organizationTeamsPage.waitMessageToHide();
	await organizationTeamsPage.verifyTeamIsDeleted(
		editTeamName
	);
});
