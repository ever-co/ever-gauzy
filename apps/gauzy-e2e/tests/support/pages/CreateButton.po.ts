import { verifyElementIsVisible, verifyText, dispatchClick, waitForSpinnerGone, waitUntil } from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { CreateButton } from '../../../src/support/Base/pageobjects/CreateButtonPageObject';

export const createButtonVisible = async () => {
	await verifyElementIsVisible(CreateButton.createButtonCss);
};

export const clickCreateButton = async () => {
	// Opening the Quick Actions dialog: a coordinate click can land on a fading cdk-overlay
	// backdrop left by a previously-closed dialog — dispatch the (click) handler directly.
	await dispatchClick(CreateButton.createButtonCss);
};

export const verifyQuickActionsDialog = async (text) => {
	await verifyElementIsVisible(CreateButton.quickActionsCss);
	await verifyText(CreateButton.quickActionsTitleCss, text);
};

export const verifyGroupHeaderExist = async (text) => {
	await verifyText(CreateButton.groupHeaderCss, text);
};

// The Quick Actions menu options are now navigation links (Create Income, Time Log, ...).
// Verify each is present rather than clicking through to obsolete in-page "Add X" cards.
export const verifyOptionExist = async (text) => {
	await verifyText(CreateButton.createButtonOptionCss, text);
};

export const closeButtonVisible = async () => {
	await verifyElementIsVisible(CreateButton.closeButtonCss);
};

export const clickCloseButton = async () => {
	// dispatchClick: the close <span> sits inside the dialog; dispatch avoids the overlay backdrop.
	await dispatchClick(CreateButton.closeButtonCss);
	await waitForSpinnerGone();
	await waitUntil(500);
};
