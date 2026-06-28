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

// The equipment <-> equipment-sharing <-> equipment-sharing-policy buttons are routerLink buttons
// fired via dispatchClick (fire-and-forget). The original flow then immediately ran the next step,
// which raced the still-pending route change: the in-between visibility checks pass against the Add /
// status="primary" buttons that exist on BOTH pages, so the wrong button got clicked on the wrong
// page (an "Add Equipment" dialog opened while on the equipment-sharing page). After each nav click,
// wait for the destination route to actually be active, plus a spinner/settle, before continuing.
const waitForRoute = async (urlGlob: string) => {
	const page = getPage();
	await page.waitForURL(urlGlob, { timeout: 24000 }).catch(() => undefined);
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => undefined);
};

// The spec navigates to the equipment grid with a bare hash goto() issued right after the addTag
// CustomCommand (which ends on /#/pages/organization/tags). A hash-only goto() to a same-origin URL
// can be a SAME-DOCUMENT NO-OP — Playwright doesn't reload and the Angular hash-router never
// re-renders — leaving the page on the tags screen, where the Add button selector
// (button[status="success"]:has-text("Add")) ALSO matches, so the wrong (tags) dialog gets opened
// and the equipment formcontrolname="name" check then fails. Mirror commands.ts' gotoRoute: force
// the hash if goto() didn't take, settle, then BLOCK on the equipment grid header so the caller
// never interacts mid-transition or on the wrong screen.
export const navigateToEquipment = async () => {
	const page = getPage();
	const route = '/#/pages/organization/equipment';
	await page.goto(route);
	await page.evaluate(() => {
		if (!location.hash.includes('/pages/organization/equipment')) {
			location.hash = '#/pages/organization/equipment';
		}
	});
	await page.waitForTimeout(800);
	// Equipment grid header (<h4> "Equipment for ...") — proves the equipment screen actually rendered,
	// not the leftover tags screen, before the caller clicks the (shared) Add button.
	await page
		.locator('ngx-header-title:has-text("Equipment")')
		.first()
		.waitFor({ state: 'visible', timeout: 30000 })
		.catch(() => undefined);
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => undefined);
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
	//
	// ROOT CAUSE (round 4, policy save): the equipment-sharing-policy "Add" dialog was left OPEN with
	// both fields filled and Save visibly enabled, yet nothing was created (failure DOM + screenshot:
	// grid empty, dialog still up). Two things make a bare `dispatchClick(saveButtonCss).first()` miss
	// the real Save:
	//   (a) Save is [disabled]="form.invalid". dispatchEvent('click') on a momentarily-disabled
	//       <button> (the last field's .fill() input event hadn't yet propagated to the reactive form)
	//       is a no-op — disabled controls don't run click handlers.
	//   (b) A just-closed dialog (the step-1 equipment dialog) can leave a detached-but-not-yet-GC'd
	//       cdk-overlay whose own `nb-card-footer button[status="success"]` is FIRST in DOM order, so
	//       `.first()` dispatches on the stale/hidden Save instead of the live dialog's.
	// Fix: target the VISIBLE Save button, wait until it is actually enabled, dispatch, and re-dispatch
	// (up to a few tries) until the dialog's footer Save detaches (dialog closed == save committed).
	const page = getPage();
	const visibleSave = page.locator(OrganizationEquipmentPage.saveButtonCss).filter({ visible: true }).last();
	for (let attempt = 0; attempt < 4; attempt++) {
		await waitForSpinnerGone();
		try {
			await visibleSave.waitFor({ state: 'visible', timeout: 6000 });
		} catch {
			// No visible Save footer left — the dialog already closed (save committed).
			return;
		}
		// Wait for the live Save button to be enabled (form valid) before dispatching.
		await page
			.waitForFunction(
				(sel) => {
					const btns = Array.from(document.querySelectorAll(sel)) as HTMLButtonElement[];
					const live = btns.reverse().find((b) => b.offsetParent !== null);
					return !!live && !live.disabled && live.getAttribute('disabled') === null;
				},
				OrganizationEquipmentPage.saveButtonCss,
				{ timeout: 8000 }
			)
			.catch(() => undefined);
		await visibleSave.dispatchEvent('click').catch(() => undefined);
		// Give the save round-trip a beat, then check whether the dialog closed.
		await page.waitForTimeout(1200);
		const stillOpen = await visibleSave.isVisible().catch(() => false);
		if (!stillOpen) return;
	}
};

export const equipmentSharingButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.equipmentSharingButtonCss);
};

export const clickEquipmentSharingButton = async () => {
	// Navigation button clicked right after a save toastr/dialog teardown — dispatchClick past backdrop,
	// then BLOCK until the equipment-sharing route is active so the next step doesn't race the route change.
	await dispatchClick(OrganizationEquipmentPage.equipmentSharingButtonCss);
	await waitForRoute(OrganizationEquipmentPage.equipmentSharingRoute);
};

export const sharingPolicyButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEquipmentPage.equipmentSharingPolicyButtonCss);
};

export const clickSharingPolicyButton = async () => {
	// Block until the equipment-sharing-policy route is active before the next step opens the Add dialog —
	// otherwise the Add click can land on the equipment-sharing page's Add (wrong dialog).
	await dispatchClick(OrganizationEquipmentPage.equipmentSharingPolicyButtonCss);
	await waitForRoute(OrganizationEquipmentPage.equipmentSharingPolicyRoute);
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
	// Back uses location.back(), whose destination differs per step (equipment-sharing vs equipment), so
	// settle on navigation/spinner generically rather than asserting one URL.
	await dispatchClick(OrganizationEquipmentPage.backButtonCss);
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => undefined);
	await getPage().waitForTimeout(1000);
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
	// Best-effort employee pick (mirrors ContactsLeads.po selectEmployeeDropdownOption): the
	// ga-employee-multi-select options are the org's employees "working" in the header date range,
	// loaded async, and can legitimately be EMPTY (no one working in range on the test DB). A hard
	// clickButtonByIndex(0) with the 60s task timeout would hang forever on an empty list. Wait briefly
	// for an option, click it if present, otherwise Escape and continue — the request saves without an
	// employee selected, so the flow still completes.
	const page = getPage();
	const option = page.locator(OrganizationEquipmentPage.selectEmployeeDropdownOptionCss);
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
	} catch {
		await page.keyboard.press('Escape').catch(() => {});
	}
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
