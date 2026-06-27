import { verifyElementIsVisible, clickButton, verifyText, verifyStateByIndex, waitForSpinnerGone } from '../util';
import { getPage } from '../page-context';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { SMSGatewaysPage } from '../../../src/support/Base/pageobjects/SMSGatewaysPageObject';

export const headerTextExist = async (text: string) => verifyText(SMSGatewaysPage.headerTextCss, text);

export const subheaderTextExist = async (text: string) => verifyText(SMSGatewaysPage.subheaderTextCss, text);

export const checkboxVisible = async () => verifyElementIsVisible(SMSGatewaysPage.checkboxCss);

export const clickCheckbox = async () => {
	// Settle the freshly-navigated page first: a real (force) click is required here because the
	// nb-toggle flips via the native <label>/<input> default behaviour (dispatchClick on the span
	// would NOT fire the native change), so the target must be interactive and free of any transient
	// post-login/redirect overlay before we click.
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => {});
	await getPage().waitForTimeout(800);
	await clickButton(SMSGatewaysPage.checkboxCss);
};

export const verifyState = async (index: number, state: string) =>
	verifyStateByIndex(SMSGatewaysPage.inputCheckBoxCss, index, state);
