import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import { faker } from '@faker-js/faker';
import * as addOrganizationPage from '../../support/pages/AddOrganization.po';
import * as deleteOrganizationPage from '../../support/pages/DeleteOrganization.po';
import { AddOrganizationPageData } from '../../../src/support/Base/pagedata/AddOrganizationPageData';
import { CustomCommands } from '../../support/commands';

// Converted 1:1 from the plain DeleteOrganizationTest.spec.ts. The `Given I am logged in as the default
// user` Background step is defined once in common.steps.ts.
//
// The original flow selected grid row 0 and deleted it — i.e. it deleted whatever organization happened
// to sort first. On the current seed that is `Default Company`, the organization every other spec runs
// against; deleting it cascades away the admin's user_organization row and the seeded time-off policy,
// and took out seven downstream specs in a single run. Nor is it a local-DB artefact: "row 0" is
// seed-ordering dependent, so the same thing can happen on a fresh CI database.
//
// The spec now creates its own throwaway organization (the same stepper flow that add-organization and
// manage-organization already exercise) and deletes THAT, looked up by name. DeleteOrganization.po
// additionally refuses to delete a row belonging to a seeded organization.

let organizationName = ' ';
let organizationTag = ' ';
let taxId = ' ';
let street = ' ';

When('I delete an organization', async () => {
	// A short digits-only tag, not a faker company name, is what gets typed into the grid's Name
	// filter: that input rewrites its own value on every debounced refetch, so the shorter and plainer
	// the search term the smaller the window for it to be clobbered mid-entry.
	organizationTag = faker.string.numeric(8);
	organizationName = `Delete Organization ${organizationTag}`;
	taxId = faker.string.alphanumeric();
	street = faker.location.streetAddress();

	// Create the organization this spec is allowed to destroy.
	await CustomCommands.addOrganization(addOrganizationPage, organizationName, AddOrganizationPageData, taxId, street);

	await getPage().goto('/#/pages/organizations');
	await deleteOrganizationPage.gridBtnExists();
	await deleteOrganizationPage.gridBtnClick();
	// The grid pages at 10 rows and accumulates organizations across the suite, so narrow it to the
	// throwaway organization before selecting — otherwise its row is simply not rendered.
	await deleteOrganizationPage.searchOrganizationByName(organizationTag);
	// Selecting a row enables the (otherwise disabled) toolbar Delete button.
	await deleteOrganizationPage.selectOrganization(organizationName);
	// Assert the Delete button AFTER the selection that reveals it. This used to run before
	// selectOrganization and passed anyway: the idle strip hid itself with translateX, which kept a
	// non-empty bounding box, so Playwright reported the clipped button as visible. #9975 collapsed the
	// idle strip to zero width (max-width/opacity/visibility), making the assertion honest — and
	// exposing that it had been vacuous all along.
	await deleteOrganizationPage.deleteBtnExists();
	await deleteOrganizationPage.deleteBtnClick();
	await deleteOrganizationPage.confirmBtnExists();
	await deleteOrganizationPage.confirmBtnClick();
	await deleteOrganizationPage.verifyOrganizationDeleted(organizationName);
});
