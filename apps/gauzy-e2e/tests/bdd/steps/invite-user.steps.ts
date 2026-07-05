import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as inviteUserPage from '../../support/pages/InviteUser.po';
import { faker } from '@faker-js/faker';
import { InviteUserPageData } from '../../../src/support/Base/pagedata/InviteUserPageData';

// Converted 1:1 from the plain InviteUserTest.spec.ts: the single test() -> one Scenario, its lone
// test.step() -> one When step whose body is the verbatim .po call sequence, so runtime behaviour is
// identical to the already-CI-tested spec. The faker-generated emails, declared at module scope in the
// original test(), stay at module scope here and are initialised at the start of the step body. The
// `Given I am logged in as the default user` Background step is defined once in common.steps.ts.

let email = ' ';
let secEmail = ' ';

When('I send a user invite', async () => {
	email = faker.internet.exampleEmail();
	secEmail = faker.internet.exampleEmail();

	await getPage().goto('/#/pages/users');
	await inviteUserPage.inviteButtonVisible();
	await inviteUserPage.clickInviteButton();
	await inviteUserPage.emailInputVisible();
	await inviteUserPage.enterEmailData(email);
	await inviteUserPage.enterEmailData(secEmail);
	await inviteUserPage.dateInputVisible();
	await inviteUserPage.enterDateData();
	await inviteUserPage.clickKeyboardButtonByKeyCode(9);
	await inviteUserPage.selectRoleVisible();
	await inviteUserPage.chooseRoleSelectData(InviteUserPageData.role);
	await inviteUserPage.sendInviteButtonVisible();
	await inviteUserPage.clickSendInviteButton();
});
