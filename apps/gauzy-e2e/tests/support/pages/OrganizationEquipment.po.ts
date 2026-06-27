import dayjs from 'dayjs';
import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	waitElementToHide,
	verifyText,
	verifyElementNotExist,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { OrganizationEquipmentPage } from '../../../src/support/Base/pageobjects/OrganizationEquipmentPageObject';

// The preceding shared addTag step can leave its modal "Add Tags" dialog (ngx-tags-mutation) open
// when its Save raced while still disabled — its cdk-overlay backdrop then intercepts every click on
// the Equipment page, so the equipment "Add" button never opens the mutation dialog and the next
// formcontrolname="name" check matches the leftover tag dialog instead. Defensively dismiss any
// lingering tag dialog (Escape + close icon) and wait for its overlay to detach before continuing.
const dismissLeftoverDialogs = async () => {
	const page = getPage();
	const tagDialog = page.locator(OrganizationEquipmentPage.tagsMutationCss).first();
	if (await tagDialog.isVisible().catch(() => false)) {
		await page.keyboard.press('Escape').catch(() => undefined);
		await tagDialog.locator('.cancel i').first().dispatchEvent('click').catch(() => undefined);
		await tagDialog.waitFor({ state: 'detached', timeout: 8000 }).catch(() => undefined);
	}
	// Absorb a fading cdk-overlay backdrop left behind by any just-closed dialog.
	await page
		.locator('.cdk-overlay-backdrop')
		.first()
		.waitFor({ state: 'detached', timeout: 4000 })
		.catch(() => undefined);
};

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addEquipmentButtonVisible = async () => {
	// Clear any leftover (tag) dialog first so the Add button is actually clickable, not just rendered.
	await dismissLeftoverDialogs();
	await verifyElementIsVisible(OrganizationEquipmentPage.addButtonCss);
};

export const clickAddEquipmentButton = async () => {
	// dispatchClick fires the DOM click on the button directly — bypasses any residual overlay backdrop
	// (force:true coordinate clicks still land on the backdrop) so the equipment dialog reliably opens.
	await dispatchClick(OrganizationEquipmentPage.addButtonCss);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.nameInputCss);
};

export const enterNameInputData = async (data: string) => {
	await clearField(OrganizationEquipmentPage.nameInputCss);
	await enterInput(OrganizationEquipmentPage.nameInputCss, data);
};

export const typeInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.typeInputCss);
};

export const enterTypeInputData = async (data: string) => {
	await clearField(OrganizationEquipmentPage.typeInputCss);
	await enterInput(OrganizationEquipmentPage.typeInputCss, data);
};

export const serialNumberInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.serialNumberInputCss);
};

export const enterSerialNumberInputData = async (data: string) => {
	await clearField(OrganizationEquipmentPage.serialNumberInputCss);
	await enterInput(OrganizationEquipmentPage.serialNumberInputCss, data);
};

export const manufacturedYearInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.manufacturedYearInputCss);
};

export const enterManufacturedYearInputData = async (data: string) => {
	await clearField(OrganizationEquipmentPage.manufacturedYearInputCss);
	await enterInput(OrganizationEquipmentPage.manufacturedYearInputCss, data);
};

export const initialCostInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.initialCostInputCss);
};

export const enterInitialCostInputData = async (data: string) => {
	await clearField(OrganizationEquipmentPage.initialCostInputCss);
	await enterInput(OrganizationEquipmentPage.initialCostInputCss, data);
};

export const sharePeriodInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.maxSharePeriodInputCss);
};

export const enterSharePeriodInputData = async (data: string) => {
	await clearField(OrganizationEquipmentPage.maxSharePeriodInputCss);
	await enterInput(OrganizationEquipmentPage.maxSharePeriodInputCss, data);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.addTagsDropdownCss);
};

export const clickTagsDropdown = async () => {
	// ng-select (#addTags) opens on mousedown and is backdrop-blocked; a force-click can also CLOSE the
	// add form. Open it via keyboard instead (focus the inner input + ArrowDown).
	const input = getPage().locator(OrganizationEquipmentPage.addTagsDropdownCss).locator('input').first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const selectTagFromDropdown = async (index: number) => {
	await clickButtonByIndex(OrganizationEquipmentPage.tagsDropdownOption, index);
};

export const clickCardBody = async () => {
	await clickButton(OrganizationEquipmentPage.footerCss);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	// Save sits in the dialog footer; the just-closed tags ng-select overlay (appendTo="body") can
	// still be fading over it. Settle, then dispatchClick to fire past any residual backdrop.
	await waitForSpinnerGone();
	await dispatchClick(OrganizationEquipmentPage.saveButtonCss);
};

export const equipmentSharingButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.equipmentSharingButtonCss);
};

export const clickEquipmentSharingButton = async () => {
	// Navigation button clicked right after a save toastr/dialog teardown — dispatchClick past backdrop.
	await dispatchClick(OrganizationEquipmentPage.equipmentSharingButtonCss);
};

export const sharingPolicyButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.equipmentSharingPolicyButtonCss);
};

export const clickSharingPolicyButton = async () => {
	await dispatchClick(OrganizationEquipmentPage.equipmentSharingPolicyButtonCss);
};

export const addPolicyButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.addButtonCss);
};

export const clickAddPolicyButton = async () => {
	await dispatchClick(OrganizationEquipmentPage.addButtonCss);
};

export const policyNameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.policyNameInputCss);
};

export const enterPolicyNameInputData = async (data: string) => {
	await clearField(OrganizationEquipmentPage.policyNameInputCss);
	await enterInput(OrganizationEquipmentPage.policyNameInputCss, data);
};

export const policyDescriptionInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.policyDescriptionInputCss);
};

export const enterPolicyDescriptionInputData = async (data: string) => {
	await clearField(OrganizationEquipmentPage.policyDescriptionInputCss);
	await enterInput(OrganizationEquipmentPage.policyDescriptionInputCss, data);
};

export const savePolicyButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.saveButtonCss);
};

export const clickSavePolicyButton = async () => {
	await clickButton(OrganizationEquipmentPage.saveButtonCss);
};

export const backButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.backButtonCss);
};

export const clickBackButton = async () => {
	// Clicked right after a save (toastr/dialog teardown) — dispatchClick past any residual backdrop.
	await dispatchClick(OrganizationEquipmentPage.backButtonCss);
};

export const requestButtonVisible = async () => {
	await dismissLeftoverDialogs();
	await verifyElementIsVisible(OrganizationEquipmentPage.addButtonCss);
};

export const clickRequestButton = async () => {
	await dispatchClick(OrganizationEquipmentPage.addButtonCss);
};

export const requestNameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.requestNameInputCss);
};

export const enterRequestNameInputData = async (data: string) => {
	await clearField(OrganizationEquipmentPage.requestNameInputCss);
	await enterInput(OrganizationEquipmentPage.requestNameInputCss, data);
};

export const selectEquipmentDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.selectEquipmentDropdownCss);
};

export const clickEquipmentDropdown = async () => {
	await clickButton(OrganizationEquipmentPage.selectEquipmentDropdownCss);
};

export const selectEquipmentFromDropdown = async (index: number) => {
	await clickButtonByIndex(OrganizationEquipmentPage.selectEquipmentDropdownOptionCss, index);
};

export const approvalPolicyDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.selectPolicyDropdownCss);
};

export const clickSelectPolicyDropdown = async () => {
	await clickButton(OrganizationEquipmentPage.selectPolicyDropdownCss);
};

export const selectPolicyFromDropdown = async (index: number) => {
	await clickButtonByIndex(OrganizationEquipmentPage.selectPolicyDropdownOptionCss, index);
};

export const selectEmployeeDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.selectEmployeeDropdownCss);
};

export const clickEmployeeDropdown = async () => {
	await clickButton(OrganizationEquipmentPage.selectEmployeeDropdownCss);
};

export const selectEmployeeFromDropdown = async (index: number) => {
	await clickButtonByIndex(OrganizationEquipmentPage.selectEmployeeDropdownOptionCss, index);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const dateInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.dateInputCss);
};

export const enterDateData = async () => {
	await clearField(OrganizationEquipmentPage.dateInputCss);
	const date = dayjs().format('MMM D, YYYY');
	await enterInput(OrganizationEquipmentPage.dateInputCss, date);
};

export const startDateInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.startDateInputCss);
};

export const enterStartDateData = async () => {
	await clearField(OrganizationEquipmentPage.startDateInputCss);
	const date = dayjs().add(1, 'days').format('MMM D, YYYY');
	await enterInput(OrganizationEquipmentPage.startDateInputCss, date);
};

export const endDateInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.endDateInputCss);
};

export const enterEndDateData = async () => {
	await clearField(OrganizationEquipmentPage.endDateInputCss);
	const date = dayjs().add(2, 'days').format('MMM D, YYYY');
	await enterInput(OrganizationEquipmentPage.endDateInputCss, date);
};

export const saveRequestButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.saveButtonCss);
};

export const clickSaveRequestButton = async () => {
	await clickButton(OrganizationEquipmentPage.saveButtonCss);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.selectTableRowCss);
};

export const selectTableRow = async (index: number) => {
	// Row selection TOGGLES; rapid re-clicks deselect. Let the grid settle (reload after the prior
	// save/navigation), click the data row ONCE, then poll the Edit button's real `disabled` attr and
	// only re-click if selection was lost. Never rapid re-click.
	const page = getPage();
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const row = page.locator(OrganizationEquipmentPage.selectTableRowCss).nth(index);
	const editBtn = page.locator(OrganizationEquipmentPage.editEquipmentButtonCss).first();
	for (let attempt = 0; attempt < 3; attempt++) {
		await row.click({ force: true });
		try {
			await editBtn.waitFor({ state: 'visible', timeout: 4000 });
			const disabled = await editBtn.getAttribute('disabled');
			if (disabled === null) return; // selection enabled the toolbar — done
		} catch {
			/* edit button not ready yet — retry */
		}
		await page.waitForTimeout(800);
	}
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.editEquipmentButtonCss);
};

export const clickEditButton = async () => {
	await dispatchClick(OrganizationEquipmentPage.editEquipmentButtonCss);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.deleteEquipmentButtonCss);
};

export const clickDeleteButton = async () => {
	await dispatchClick(OrganizationEquipmentPage.deleteEquipmentButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	// Confirm sits in a dialog opened right after the delete click — dispatchClick past its backdrop.
	await dispatchClick(OrganizationEquipmentPage.confirmDeleteButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(OrganizationEquipmentPage.toastrMessageCss);
};

export const verifyPolicyExists = async (text: string) => {
	await verifyText(OrganizationEquipmentPage.verifyPolicyCss, text);
};

export const verifyPolicyIsDeleted = async () => {
	await verifyElementNotExist(OrganizationEquipmentPage.verifyPolicyCss);
};

export const verifySharingExists = async (text: string) => {
	await verifyText(OrganizationEquipmentPage.verifySharingCss, text);
};

export const verifySharingIsDeleted = async () => {
	await verifyElementNotExist(OrganizationEquipmentPage.verifySharingCss);
};

export const verifyEquipmentExists = async (text: string) => {
	await verifyText(OrganizationEquipmentPage.verifyEquipmentCss, text);
};

export const verifyEquipmentIsDeleted = async () => {
	await verifyElementNotExist(OrganizationEquipmentPage.verifyEquipmentCss);
};

export const waitSpinnerToDisappear = async () => {
	await verifyElementNotExist(OrganizationEquipmentPage.spinnerCss);
};
