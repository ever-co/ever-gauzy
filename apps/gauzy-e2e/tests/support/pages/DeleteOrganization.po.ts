import { verifyElementIsVisible, dispatchClick, waitForSpinnerGone } from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { DeleteOrganizationPage } from '../../../src/support/Base/pageobjects/DeleteOrganizationPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number = 1) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const deleteBtnExists = async () => {
	await verifyElementIsVisible(DeleteOrganizationPage.deleteButtonCss);
};

// The toolbar Delete button is [disabled] until a grid row is selected. The original flow force-clicked
// the disabled button (no-op — Angular doesn't fire (click) on a disabled control), so the confirm
// dialog never opened and confirmBtnExists timed out. Settle the grid, select the row ONCE, then poll
// the Delete button's real `disabled` attr until selection is registered before clicking it.
export const deleteBtnClick = async (index: number = 0) => {
	await selectOrganizationRow();

	// dispatchClick fires the handler even if a fading cdk-overlay backdrop sits on top.
	await dispatchClick(DeleteOrganizationPage.deleteButtonCss);
};

export const confirmBtnExists = async () => {
	await verifyElementIsVisible(DeleteOrganizationPage.confirmDeleteCss);
};

// Confirm OK is clicked right after the dialog opens; a fading backdrop can intercept a coordinate
// click — use dispatchClick so the (click)->delete() handler fires regardless.
export const confirmBtnClick = async (index: number = 0) => {
	await dispatchClick(DeleteOrganizationPage.confirmDeleteCss);
};

// Select a data row to enable the toolbar Delete button. Row click TOGGLES selection, so this must be
// idempotent: if the Delete button is already enabled (row already selected), do nothing — clicking
// again would DESELECT and re-disable it. Otherwise settle, click once, poll the Delete button's real
// `disabled` attr, and only re-click if selection didn't register.
export const selectOrganizationRow = async (index: number = 0) => {
	const deleteBtn = getPage().locator(DeleteOrganizationPage.deleteButtonCss).first();

	// Already selected (e.g. the spec called selectOrganization first) -> leave it selected.
	if ((await deleteBtn.getAttribute('disabled')) === null) return;

	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => {});
	await getPage().waitForTimeout(1500);

	const row = getPage().locator(DeleteOrganizationPage.selectOrganization).nth(index);

	await row.click({ force: true });
	for (let i = 0; i < 5; i++) {
		if ((await deleteBtn.getAttribute('disabled')) === null) return; // enabled -> selection registered
		await getPage().waitForTimeout(500);
		if ((await deleteBtn.getAttribute('disabled')) !== null) {
			await row.click({ force: true }); // selection not yet toggled on -> retry
		}
	}
};

// Back-compat: the spec/page-data may still reference selectOrganization.
export const selectOrganization = async (index: number = 0) => {
	await selectOrganizationRow(index);
};
