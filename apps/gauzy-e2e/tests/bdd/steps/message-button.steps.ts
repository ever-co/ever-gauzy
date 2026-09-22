import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as messageButton from '../../support/pages/MessageButton.po';
import { MessageButtonData } from '../../../src/support/Base/pagedata/MessageButtonPageData';
import { MessageButton } from '../../../src/support/Base/pageobjects/MessageButtonPageObject';

// Originally converted 1:1 from the plain MessageButtonTest.spec.ts. The entries it checks
// (Support Chat / FAQ / Help / About) have since moved out of a header speech-bubble menu
// and into the Quick Settings panel, so this step opens that panel instead. The Scenario
// wording is unchanged because what it asserts is unchanged: those entries are reachable.

When('I verify the message button menu items exist', async () => {
	await messageButton.messageButtonVisible();
	await messageButton.clickMessageButton();

	// Support Chat renders only when the deployment configured a Chatwoot website token
	// (`isSupportChatAvailable` in ThemeSettingsComponent). CI sets none, so the entry is
	// legitimately absent there — asserting it unconditionally would fail a correct build.
	const supportChatPresent = await getPage()
		.locator(MessageButton.supportLinksCss)
		.getByText(MessageButtonData.supportChat, { exact: true })
		.count()
		.then((n) => n > 0)
		.catch(() => false);
	if (supportChatPresent) {
		await messageButton.verifyTextExist(MessageButtonData.supportChat);
	}

	await messageButton.verifyTextExist(MessageButtonData.faq);
	await messageButton.verifyTextExist(MessageButtonData.help);
	await messageButton.verifyTextExist(MessageButtonData.about);
});
