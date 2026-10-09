import {
	applySmartTableFilter,
	verifyElementIsVisible,
	verifyElementIsVisibleByIndex,
	waitElementToHide,
	verifyText,
	clickByText,
	verifyElementNotExist,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { RemoveUserPage } from '../../../src/support/Base/pageobjects/RemoveUserPageObject';

export const gridButtonVisible = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const clickGridButton = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

// Filter the users grid by Full Name so the just-added user is the only data row on page 1. The shared
// serial DB accumulates users from earlier specs (seed admin + faker employees from addEmployee), so the
// grid paginates and a freshly-added user can land on page 2 — invisible to a filter-by-text verify or a
// row click.
//
// This used to be a bare .fill(), which sets the box's text but dispatches only 'input' — an event the
// smart-table InputFilterComponent does not listen for. The failing run's snapshot proves it: the Full
// Name box held the new user's full name while the grid still showed "1 - 10 of 14 Items" with every
// user on it, and the new user sat on page 2, never rendered. applySmartTableFilter dispatches the
// 'change' the component actually subscribes to and reads the value back.
export const filterByName = async (name: string) => {
	await applySmartTableFilter(RemoveUserPage.nameFilterInputCss, name);
};

export const tableBodyExists = async () => {
	await verifyElementIsVisibleByIndex(RemoveUserPage.selectTableRowCss, 0);
};

export const clickTableRow = async (text: string) => {
	// Selecting a grid row TOGGLES selection and enables the toolbar Remove button (it is
	// [disabled]="disableButton" until a row is selected). Settle the grid first so the click lands
	// on the rendered row, then click the matching row ONCE — a rapid re-click would toggle the
	// selection back off. Poll the Remove button's real `disabled` attr and re-click only if the
	// selection didn't take.
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => {});
	await getPage().waitForTimeout(1500);
	await clickByText(RemoveUserPage.selectTableRowCss, text);

	const removeBtn = getPage().locator(RemoveUserPage.removeButtonCss).first();
	for (let i = 0; i < 3; i++) {
		const disabled = await removeBtn.getAttribute('disabled');
		if (disabled === null) return; // selection took, toolbar enabled
		await getPage().waitForTimeout(1000);
		await clickByText(RemoveUserPage.selectTableRowCss, text);
	}
};

export const removeButtonVisible = async () => {
	await verifyElementIsVisible(RemoveUserPage.removeButtonCss);
};

export const clickRemoveButton = async () => {
	// Toolbar Remove fires after row selection; dispatch so a fading selection/overlay can't swallow
	// the (click)="removeUserFromOrganization(...)" handler and the confirm dialog never opens.
	await waitForSpinnerGone();
	await dispatchClick(RemoveUserPage.removeButtonCss);
};

export const confirmRemoveBtnVisible = async () => {
	await verifyElementIsVisible(RemoveUserPage.confirmRemoveUserButtonCss);
};

export const clickConfirmRemoveButton = async () => {
	// Confirm (OK, status="danger") on the freshly-opened DeleteConfirmation dialog; dispatch so its
	// own cdk-overlay backdrop can't intercept the (click)="delete()" handler.
	await dispatchClick(RemoveUserPage.confirmRemoveUserButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(RemoveUserPage.toastrMessageCss);
};

export const verifyUserExists = async (text) => {
	await verifyText(RemoveUserPage.verifyUserCss, text);
};

export const verifyUserIsDeleted = async (text) => {
	await verifyElementNotExist(`${RemoveUserPage.verifyUserCss}:has-text("${text}")`);
};
