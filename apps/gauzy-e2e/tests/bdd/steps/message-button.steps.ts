import { When } from '../../support/bdd';
import * as messageButton from '../../support/pages/MessageButton.po';
import { MessageButtonData } from '../../../src/support/Base/pagedata/MessageButtonPageData';

// Converted 1:1 from the plain MessageButtonTest.spec.ts: the single test() -> one Scenario, the single
// test.step() -> one When step whose body is the verbatim .po call sequence, so runtime behaviour is
// identical to the already-CI-tested spec. The `Given I am logged in as the default user` Background
// step is defined once in common.steps.ts.

When('I verify the message button menu items exist', async () => {
	await messageButton.messageButtonVisible();
	await messageButton.clickMessageButton();
	await messageButton.verifyTextExist(MessageButtonData.supportChat);
	await messageButton.verifyTextExist(MessageButtonData.faq);
	await messageButton.verifyTextExist(MessageButtonData.help);
	await messageButton.verifyTextExist(MessageButtonData.about);
});
