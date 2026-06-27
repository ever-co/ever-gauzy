import {
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	clickButtonByIndex,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	waitElementToHide,
	verifyText,
	clickButtonWithForce,
	clickByText,
	verifyTextByIndex,
	verifyTextNotExistByIndex,
	verifyByText,
	verifyByLength,
	verifyTextNotExisting,
	dispatchClick
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { ApprovalRequestPage } from '../../../src/support/Base/pageobjects/ApprovalRequestPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addApprovalButtonVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.addApprovalRequestButtonCss);
};

export const clickAddApprovalButton = async () => {
	await clickButton(ApprovalRequestPage.addApprovalRequestButtonCss);
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.nameInputCss);
};

export const enterNameInputData = async (data) => {
	await clearField(ApprovalRequestPage.nameInputCss);
	await enterInput(ApprovalRequestPage.nameInputCss, data);
};

export const minCountInputVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.minCountInputCss);
};

export const enterMinCountInputData = async (data) => {
	await enterInput(ApprovalRequestPage.minCountInputCss, data);
};

export const approvalPolicyDropdownVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.approvalPolicyDropdownCss);
};

export const clickApprovalPolicyDropdown = async () => {
	await clickButton(ApprovalRequestPage.approvalPolicyDropdownCss);
};

export const selectApprovalPolicyOptionDropdown = async (text) => {
	await clickElementByText(ApprovalRequestPage.checkApprovalPolicyDropdownOptionCss, text);
};

export const selectEmployeeDropdownVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.usersMultiSelectCss);
};

export const clickSelectEmployeeDropdown = async () => {
	await clickButton(ApprovalRequestPage.usersMultiSelectCss);
};

export const selectEmployeeFromDropdown = async (index) => {
	await clickButtonByIndex(ApprovalRequestPage.checkUsersMultiSelectCss, index);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	await clickButton(ApprovalRequestPage.saveButtonCss);
};

export const selectTableRowVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.selectTableRowCss);
};

export const selectTableRow = async (index) => {
	// Row click TOGGLES selection and enables the toolbar Edit/Delete buttons. Settle the grid first, then
	// click the row ONCE and poll the Edit button's real `disabled` attr; only re-click if selection was
	// lost. A rapid re-click would toggle the row back off and leave the toolbar disabled (force-clicking a
	// disabled Edit button is a no-op, so the next dialog never opens).
	const page = getPage();
	await page.waitForLoadState('networkidle').catch(() => undefined);
	await page.waitForTimeout(1500);
	const row = page.locator(ApprovalRequestPage.selectTableRowCss).nth(index);
	const editBtn = page.locator(ApprovalRequestPage.editApprovalRequestButtonCss).first();
	await row.click({ force: true, timeout: 60_000 });
	for (let i = 0; i < 10; i++) {
		const disabled = await editBtn.getAttribute('disabled');
		if (disabled === null) return; // selection took: Edit is enabled
		await page.waitForTimeout(500);
		if (i === 4) await row.click({ force: true, timeout: 60_000 }); // re-click once mid-poll if still disabled
	}
};

export const editApprovalRequestButtonVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.editApprovalRequestButtonCss);
};

export const clickEditApprovalRequestButton = async () => {
	const page = getPage();
	await Promise.all([
		page.waitForResponse((res) => res.url().includes('/api/approval-policy/request-approval')),
		clickButton(ApprovalRequestPage.editApprovalRequestButtonCss)
	]);
};

export const deleteApprovalRequestButtonVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.deleteApprovalRequestButtonCss);
};

export const clickDeleteApprovalRequestButton = async () => {
	await clickButton(ApprovalRequestPage.deleteApprovalRequestButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	// The actual delete only fires when the confirmation dialog's OK (status="danger") is clicked.
	// dispatchClick fires the handler directly so a fading backdrop from the just-opened dialog can't
	// intercept it.
	await dispatchClick(ApprovalRequestPage.confirmDeleteButtonCss);
};

export const approvalPolicyButtonVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.approvalPolicyButtonCss);
};

export const clickApprovalPolicyButton = async () => {
	// "Approval Policy" navigates to /pages/organization/approval-policy (router.navigate, not a dialog).
	// This button is clicked right after the addTag/addEmployee dialog flows, whose fading cdk-overlay
	// backdrop can swallow a coordinate click — the click was lost and the test stayed on the approvals
	// page (then opened the request, not policy, dialog). dispatchClick fires the (click) handler directly,
	// and we wait for the route change so the next steps don't race the in-flight navigation.
	await dispatchClick(ApprovalRequestPage.approvalPolicyButtonCss);
	await getPage()
		.waitForURL((url) => /\/pages\/organization\/approval-policy(\?|$)/.test(url.href), { timeout: 30000 })
		.catch(() => undefined);
};

export const descriptionInputVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.descriptionInputCss);
};

export const enterDescriptionInputData = async (data) => {
	await clearField(ApprovalRequestPage.descriptionInputCss);
	await enterInput(ApprovalRequestPage.descriptionInputCss, data);
};

export const backButtonVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.backButtonCss);
};

export const clickBackButton = async () => {
	// Back-navigation returns from the approval-policy page to /pages/employees/approvals. Wait for that
	// route change so the next step (add request) doesn't race the in-flight navigation and click the
	// stale (policy-page) Add button.
	await clickButton(ApprovalRequestPage.backButtonCss);
	await getPage()
		.waitForURL((url) => /\/pages\/employees\/approvals(\?|$)/.test(url.href), { timeout: 30000 })
		.catch(() => undefined);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(ApprovalRequestPage.toastrMessageCss);
};

export const verifyApprovalPolicyExists = async (text) => {
	await verifyText(ApprovalRequestPage.verifyApprovalPolicyCss, text);
};

export const verifyRequestExists = async (text) => {
	await verifyText(ApprovalRequestPage.verifyRequestCss, text);
};

export const verifyElementIsDeleted = async (text: string) => {
	await verifyTextNotExisting(ApprovalRequestPage.tableBodyCss, text);
};

export const clickSaveButtonWithForce = async () => {
	await clickButtonWithForce(ApprovalRequestPage.saveButtonCss);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.addTagsDropdownCss);
};

export const clickTagsDropdown = async () => {
	await clickButton(ApprovalRequestPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = async (index) => {
	await clickButtonByIndex(ApprovalRequestPage.tagsDropdownOption, index);
};

export const clickCardBody = async () => {
	await clickButton(ApprovalRequestPage.nameInputCss);
};

export const verifyApprovalRefuseButton = async (text: string, index: number) => {
	await verifyTextByIndex(ApprovalRequestPage.approvalRefuseButtonCss, text, index);
};

export const clickOnApprovalRefuseButton = async (text: string) => {
	await clickByText(ApprovalRequestPage.approvalRefuseButtonCss, text);
};

export const verifyApprovalButtonNotExist = async (text: string, index: number) => {
	await verifyTextNotExistByIndex(ApprovalRequestPage.approvalRefuseButtonCss, index, text);
};

export const verifyStatus = async (text: string) => {
	await verifyByText(ApprovalRequestPage.rowCss, text);
};

export const verifyNameInput = async () => {
	await verifyElementIsVisible(ApprovalRequestPage.searchByNameInputCss);
};

export const searchApprovalRequest = async (text: string, length: number) => {
	await clearField(ApprovalRequestPage.searchByNameInputCss);
	await enterInput(ApprovalRequestPage.searchByNameInputCss, text);
	await verifyByLength(ApprovalRequestPage.approvalStatusCss, length);
};

export const clearNameSearchInput = async () => {
	await clearField(ApprovalRequestPage.searchByNameInputCss);
};

export const waitTableLoad = async (length: number) => {
	await verifyByLength(ApprovalRequestPage.approvalStatusCss, length);
};
