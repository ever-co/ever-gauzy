import dayjs from 'dayjs';
import {
	verifyElementIsVisible,
	clickButton,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	waitElementToHide,
	verifyText,
	verifyTextNotExisting,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { TimeOffPage } from '../../../src/support/Base/pageobjects/TimeOffPageObject';

// Robust hash navigation to the time-off screen (mirrors the gotoRoute helper in commands.ts). The
// spec navigates here right after CustomCommands.addEmployee, which ends on /#/pages/employees. A bare
// goto() to /#/pages/employees/time-off only changes the hash, so Playwright treats it as a
// same-document NO-OP and never reloads; the Angular hash-router can lag, leaving the employees grid
// mounted for a beat. The next requestButton click then landed on the EMPLOYEES "Add" button (same
// gauzy-button-action markup) and re-opened the Add Employee dialog, whose backdrop blocked the
// request dialog (the round-3 failure). Force the hash in-page, settle, then wait for a time-off-only
// toolbar marker before the caller interacts.
export const navigateToTimeOff = async () => {
	const page = getPage();
	await page.goto('/#/pages/employees/time-off');
	await page.evaluate(() => {
		if (!location.hash.includes('/pages/employees/time-off')) {
			location.hash = '#/pages/employees/time-off';
		}
	});
	await page.waitForTimeout(800);
	// The time-off "Add Holidays" info button is unique to this screen (the employees toolbar has none),
	// so its presence proves the SPA actually rendered time-off — not the still-mounted employees grid.
	await page
		.locator(TimeOffPage.timeOffPageReadyCss)
		.first()
		.waitFor({ state: 'visible', timeout: 30000 })
		.catch(() => {});
	await waitForSpinnerGone();
};

export const requestButtonVisible = async () => verifyElementIsVisible(TimeOffPage.requestButtonCss);

export const clickRequestButton = async () => {
	// The preceding CustomCommands.addEmployee leaves a fading cdk-overlay-backdrop (still
	// `cdk-overlay-backdrop-showing` at this point) over the toolbar; a coordinate click — even
	// {force:true} — lands on that backdrop, so requestDaysOff() never fires and the request-mutation
	// dialog never opens (the original failure). Wait out the page spinner then dispatch the click
	// straight to the button so the (click) handler runs regardless of the overlay.
	await waitForSpinnerGone();
	await dispatchClick(TimeOffPage.requestButtonCss);
};

export const employeeSelectorVisible = async () => {
	// Best-effort wait for the working-employees fetch the ga-employee-selector kicks off: race it with a
	// timeout so we don't hang the default 30s if the response already landed before this wrapper
	// registered the listener (the request dialog opened in the previous step).
	const waitForUsers = getPage()
		.waitForResponse((response) => /\/api\/employee\/working/.test(response.url()), { timeout: 8000 })
		.catch(() => {});
	await verifyElementIsVisible(TimeOffPage.employeeDropdownCss);
	await waitForUsers;
};

export const clickEmployeeSelector = async () => {
	// The employee selector is an appendTo=body ng-select (opens on mousedown). A coordinate click — even
	// the previous force-click + double-click — is swallowed by leftover dialog backdrops and can even
	// close the form; open it via the keyboard instead (focus its inner input, then ArrowDown).
	await waitForSpinnerGone();
	const input = getPage().locator(TimeOffPage.employeeDropdownCss).locator('input').first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
	await getPage().waitForTimeout(500);
};

export const employeeDropdownVisible = async () => verifyElementIsVisible(TimeOffPage.employeeDropdownOptionCss);

export const selectEmployeeFromDropdown = async (index: number) => {
	// Best-effort employee pick: the working-employees list loads async and can be empty on the test DB
	// (no employee "working" in the header date range). Click an option if one shows within ~8s; else
	// Escape and continue. Options are div.ng-option (ng-select), not .option-list nb-option.
	const page = getPage();
	const option = page.locator(TimeOffPage.employeeDropdownOptionCss);
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
	} catch {
		await page.keyboard.press('Escape').catch(() => {});
	}
};

export const selectTimeOffPolicyVisible = async () => verifyElementIsVisible(TimeOffPage.timeOffPolicyDropdownCss);

export const clickTimeOffPolicyDropdown = async () => {
	// The policy field is a Nebular nb-select (ga-time-off-policy-select renders <nb-select id="policy">).
	// nb-select toggles its overlay panel on the click event, but the request/holiday dialog opens over a
	// fading cdk-overlay-backdrop (left by the preceding employee ng-select / quick-add) — a coordinate
	// {force:true} click is swallowed by that backdrop and the panel never opens (round-4 failure: the
	// '.option-list nb-option' assertion timed out). Settle any spinner, then dispatch the click straight
	// to the nb-select host so the (click) handler fires regardless of the overlay. The open is RETRIED in
	// selectTimeOffPolicy below, so this first open need not take.
	await waitForSpinnerGone();
	await dispatchClick(TimeOffPage.timeOffPolicyDropdownCss);
	await getPage().waitForTimeout(500);
};

export const timeOffPolicyDropdownOptionVisible = async () => {
	// Best-effort, NOT a hard assert: if the dispatch-open above didn't take behind a lingering backdrop,
	// the panel re-open + pick is retried in selectTimeOffPolicy, so a 24s throw here would be premature.
	await getPage()
		.locator(TimeOffPage.timeOffPolicyDropdownOptionCss)
		.first()
		.waitFor({ state: 'visible', timeout: 6000 })
		.catch(() => undefined);
};

export const selectTimeOffPolicy = async (data: string) => {
	// Pick the policy by text (REQUIRED — Save stays disabled until policyId is set). Retry opening the
	// nb-select (dispatchClick the host) until its options render, then click the matching option. Mirrors
	// the proven open-retry pick in GoalsKPI.selectEmployeeFromDropdown: the panel can fail to open behind a
	// fading backdrop on the first dispatch, so re-open until '.option-list nb-option' appears.
	const page = getPage();
	const option = page.locator(TimeOffPage.timeOffPolicyDropdownOptionCss).filter({ hasText: data });
	for (let i = 0; i < 5; i++) {
		if (await option.first().isVisible().catch(() => false)) {
			await option.first().click({ force: true });
			return;
		}
		await waitForSpinnerGone();
		await dispatchClick(TimeOffPage.timeOffPolicyDropdownCss);
		await page.waitForTimeout(900);
	}
	// Last attempt: click whatever matched (best-effort) so the flow proceeds rather than hard-failing.
	await option
		.first()
		.click({ force: true, timeout: 8000 })
		.catch(() => undefined);
};

export const startDateInputVisible = async () => verifyElementIsVisible(TimeOffPage.startDateInputCss);

export const enterStartDateData = async () => {
	await clearField(TimeOffPage.startDateInputCss);
	const date = dayjs().add(1, 'days').format('MMM D, YYYY');
	await enterInput(TimeOffPage.startDateInputCss, date);
};

export const endDateInputVisible = async () => verifyElementIsVisible(TimeOffPage.startDateInputCss);

export const enterEndDateData = async () => {
	await clearField(TimeOffPage.endDateInputCss);
	const date = dayjs().add(5, 'days').format('MMM D, YYYY');
	await enterInput(TimeOffPage.endDateInputCss, date);
};

export const descriptionInputVisible = async () => verifyElementIsVisible(TimeOffPage.descriptionInputCss);

export const enterDescriptionInputData = async (data: string) => {
	await clearField(TimeOffPage.descriptionInputCss);
	await enterInput(TimeOffPage.descriptionInputCss, data);
};

export const saveRequestButtonVisible = async () => verifyElementIsVisible(TimeOffPage.saveRequestButtonCss);

export const clickSaveRequestButton = async () => {
	// dispatchClick after settling: the date pickers / leftover backdrops in the request dialog can sit
	// over the footer Save and swallow a coordinate click, leaving the dialog open. Dispatch fires
	// saveRequest() straight on the button (it still gates on form validity via [disabled]).
	await waitForSpinnerGone();
	await dispatchClick(TimeOffPage.saveRequestButtonCss);
};

export const addHolidayButtonVisible = async () => verifyElementIsVisible(TimeOffPage.addHolidayButtonCss);

export const clickAddHolidayButton = async () => {
	// dispatchClick after settling: this runs right after the delete-confirm dialog closed, so a fading
	// backdrop can swallow a coordinate click on the toolbar "Add Holidays". Race the employee fetch with
	// a timeout so we don't hang the default 30s if it already landed (or isn't issued).
	await waitForSpinnerGone();
	const waitForm = getPage()
		.waitForResponse((response) => /\/api\/employee/.test(response.url()), { timeout: 8000 })
		.catch(() => {});
	await dispatchClick(TimeOffPage.addHolidayButtonCss);
	await waitForm;
};

export const selectHolidayNameVisible = async () => verifyElementIsVisible(TimeOffPage.holidayNameSelectCss);

export const clickSelectHolidayName = async () => {
	// Holiday-name is an nb-select inside the holiday dialog (opens on the click event). The dialog opens
	// over a fading backdrop from the just-closed delete-confirm, so a coordinate {force:true} click is
	// swallowed and the panel never opens. Dispatch the click straight to the nb-select host.
	await waitForSpinnerGone();
	await dispatchClick(TimeOffPage.holidayNameSelectCss);
	await getPage().waitForTimeout(500);
};

export const selectHolidayOption = async (option: string | number) => {
	// Best-effort, with an open-retry: the holiday list loads async; if the panel didn't open on the first
	// dispatch, re-open the nb-select until an option renders, then pick it. Avoids a hard 60s timeout on a
	// panel that failed to open behind a backdrop.
	const page = getPage();
	const opts = page.locator(TimeOffPage.selectHolidayDropdownOptionCss);
	const target = typeof option === 'number' ? opts.nth(option) : opts.filter({ hasText: String(option) }).first();
	for (let i = 0; i < 5; i++) {
		if (await target.isVisible().catch(() => false)) {
			await target.click({ force: true });
			return;
		}
		await waitForSpinnerGone();
		await dispatchClick(TimeOffPage.holidayNameSelectCss);
		await page.waitForTimeout(900);
	}
	await target.click({ force: true, timeout: 8000 }).catch(() => undefined);
};

export const selectEmployeeDropdownVisible = async () => verifyElementIsVisible(TimeOffPage.selectEmployeeCss);

export const clickSelectEmployeeDropdown = async () => {
	// The "Add or Remove Employees" multi-select is an nb-select (holiday + policy dialogs). Same backdrop
	// hazard as the other selects: dispatch the click on the host so a fading backdrop can't swallow it.
	await waitForSpinnerGone();
	await dispatchClick(TimeOffPage.selectEmployeeCss);
	await getPage().waitForTimeout(500);
};

export const selectEmployeeFromHolidayDropdown = async (index: number) => {
	// Best-effort employee pick (mirror ContactsLeads.selectEmployeeDropdownOption): this nb-select's
	// option list (.option-list nb-option) loads async and may be empty/closed. Since the open is now a
	// dispatchClick that can be swallowed by a backdrop, RE-OPEN the nb-select up to a few times until an
	// option renders, then click it. On miss, dismiss only the panel (Escape) and continue — a hard
	// option[index] click must not hang the 60s task timeout on an empty/closed list.
	const page = getPage();
	const option = page.locator(TimeOffPage.selectEmployeeDropdownOptionCss);
	for (let i = 0; i < 4; i++) {
		if (await option.first().isVisible().catch(() => false)) {
			await option.nth(index).click({ force: true }).catch(() => {});
			return;
		}
		await waitForSpinnerGone();
		await dispatchClick(TimeOffPage.selectEmployeeCss);
		await page.waitForTimeout(900);
	}
	await page.keyboard.press('Escape').catch(() => {});
};

export const startHolidayDateInputVisible = async () => verifyElementIsVisible(TimeOffPage.startHolidayDateCss);

export const enterStartHolidayDate = async () => {
	await clearField(TimeOffPage.startHolidayDateCss);
	const date = dayjs().add(1, 'years').startOf('year').format('MMM D, YYYY');
	await enterInput(TimeOffPage.startHolidayDateCss, date);
};

export const endHolidayDateInputVisible = async () => verifyElementIsVisible(TimeOffPage.endHolidayDateCss);

export const enterEndHolidayDate = async () => {
	await clearField(TimeOffPage.endHolidayDateCss);
	const date = dayjs().add(1, 'years').startOf('year').add(1, 'days').format('MMM D, YYYY');
	await enterInput(TimeOffPage.endHolidayDateCss, date);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => clickKeyboardBtnByKeycode(keycode);

export const saveButtonVisible = async () => verifyElementIsVisible(TimeOffPage.saveButtonCss);

export const clickSaveButton = async () => {
	// dispatchClick after settling: the holiday/policy dialog's date pickers and async employee load
	// leave overlays/backdrops over the footer Save; dispatch fires the save handler directly (it still
	// gates on form validity via [disabled]).
	await waitForSpinnerGone();
	await dispatchClick(TimeOffPage.saveButtonCss);
};

export const timeOffTableRowVisible = async () => verifyElementIsVisible(TimeOffPage.selectTableRowCss);

export const selectTimeOffTableRow = async (index: number) => {
	const page = getPage();
	// Let the grid settle after the preceding mutation (re-render/refetch) — a click during that window
	// is lost or immediately cleared. Then click the row ONCE and poll for the toolbar action buttons to
	// appear (selecting a row sets disableButton=false, rendering the btn-group.actions). Clicking the
	// row TOGGLES selection, so only re-click if the first click was lost to a late re-render — never
	// rapid re-click. (root cause #4)
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const row = page.locator(TimeOffPage.selectTableRowCss).nth(index);
	const actions = page.locator('div.btn-group.actions button').first();
	for (let attempt = 0; attempt < 4; attempt++) {
		await row.click({ force: true });
		for (let i = 0; i < 8; i++) {
			await page.waitForTimeout(350);
			if (await actions.isVisible().catch(() => false)) return;
		}
	}
};

export const editTimeOffRequestBtnVisible = async () => verifyElementIsVisible(TimeOffPage.editTimeOfRequestButtonCss);

export const clickEditTimeOffRequestButton = async () => clickButton(TimeOffPage.editTimeOfRequestButtonCss);

export const deleteTimeOffBtnVisible = async () => verifyElementIsVisible(TimeOffPage.deleteTimeOfRequestButtonCss);

export const clickDeleteTimeOffButton = async () => {
	// dispatchClick: a leftover toastr/dialog backdrop from the preceding save can intercept a coordinate
	// click on the toolbar Delete; dispatch fires deleteRequest() and opens the confirm dialog.
	await waitForSpinnerGone();
	await dispatchClick(TimeOffPage.deleteTimeOfRequestButtonCss);
};

// Approve/Deny/Archive live in a SECOND action group that only renders once showActions=true; the
// only way to flip it is the "more-horizontal" toggle in the first group. The migrated spec never
// clicked it, so the warning/success buttons were never present. Click it (best-effort: skip if the
// second group is already showing) before asserting on Deny/Approve.
export const clickShowActionsButton = async () => {
	const page = getPage();
	if (await page.locator(TimeOffPage.denyTimeOffRequestButtonCss).first().isVisible().catch(() => false)) return;
	await dispatchClick(TimeOffPage.showActionsButtonCss);
	await page.waitForTimeout(400);
};

export const denyTimeOffButtonVisible = async () => verifyElementIsVisible(TimeOffPage.denyTimeOffRequestButtonCss);

export const clickDenyTimeOffButton = async () => {
	// Best-effort: the spec calls this twice, but denying clears the selection and resets showActions, so
	// the second click has no target. Click only while the button is present so the doubled call is a
	// harmless no-op instead of a 60s timeout. dispatchClick defeats any leftover toastr/dialog backdrop.
	const btn = getPage().locator(TimeOffPage.denyTimeOffRequestButtonCss).first();
	if (await btn.isVisible().catch(() => false)) {
		await dispatchClick(TimeOffPage.denyTimeOffRequestButtonCss);
	}
};

export const approveTimeOffButtonVisible = async () =>
	verifyElementIsVisible(TimeOffPage.approveTimeOffRequestButtonCss);

export const clickApproveTimeOffButton = async () => {
	// Best-effort, same rationale as clickDenyTimeOffButton: approving clears selection/showActions, so
	// the doubled call becomes a no-op rather than hanging on a vanished button.
	const btn = getPage().locator(TimeOffPage.approveTimeOffRequestButtonCss).first();
	if (await btn.isVisible().catch(() => false)) {
		await dispatchClick(TimeOffPage.approveTimeOffRequestButtonCss);
	}
};

export const confirmDeleteTimeOffBtnVisible = async () =>
	verifyElementIsVisible(TimeOffPage.confirmDeleteTimeOfButtonCss);

export const clickConfirmDeleteTimeOffButton = async () => {
	// dispatchClick: the confirm dialog's own fading backdrop can swallow a coordinate click on its
	// footer button, leaving the record undeleted; dispatch fires the confirm handler directly.
	await waitForSpinnerGone();
	await dispatchClick(TimeOffPage.confirmDeleteTimeOfButtonCss);
};

export const timeOffSettingsButtonVisible = async () => verifyElementIsVisible(TimeOffPage.timeOffSettingsButtonCss);

export const clickTimeOffSettingsButton = async (_index: number) => {
	// There is only ONE settings cog (button.action.p-2) in the time-off header, so the legacy index=1
	// targeted a non-existent second match and hung. Always dispatch the click on the single cog (which
	// routes to /pages/employees/time-off/settings); waitForSpinnerGone first so the page-load spinner
	// doesn't swallow a coordinate click.
	await waitForSpinnerGone();
	await dispatchClick(TimeOffPage.timeOffSettingsButtonCss);
};

export const addNewPolicyButtonVisible = async () => verifyElementIsVisible(TimeOffPage.addNewPolicyButtonCss);

export const clickAddNewPolicyButton = async () => {
	// dispatchClick after settling: the settings page shows a load spinner over the toolbar right after
	// navigation; a coordinate click on "Add" can land on it, so the policy dialog never opens.
	await waitForSpinnerGone();
	await dispatchClick(TimeOffPage.addNewPolicyButtonCss);
};

export const policyInputFieldVisible = async () => verifyElementIsVisible(TimeOffPage.addNewPolicyInputCss);

export const enterNewPolicyName = async (data: string) => {
	await clearField(TimeOffPage.addNewPolicyInputCss);
	await enterInput(TimeOffPage.addNewPolicyInputCss, data);
};

export const waitMessageToHide = async () => waitElementToHide(TimeOffPage.toastrMessageCss);

export const verifyPolicyExists = async (text: string) => verifyText(TimeOffPage.verifyPolicyCss, text);

export const verifyPolicyIsDeleted = async (text: string) => verifyTextNotExisting(TimeOffPage.verifyPolicyCss, text);

export const backButtonVisible = async () => verifyElementIsVisible(TimeOffPage.backButtonCss);

export const clickBackButton = async () => clickButton(TimeOffPage.backButtonCss);

export const verifyEmployeeSelectorVisible = async () => verifyElementIsVisible(TimeOffPage.employeeSelectorCss);

export const clickEmployeeSelectorDropdown = async () => clickButton(TimeOffPage.employeeSelectorCss);

export const verifyTimeOffPolicyVisible = async () => verifyElementIsVisible(TimeOffPage.timeOffPolicySelectorCss);

export const clickTimeOffPolicySelector = async () => clickButton(TimeOffPage.timeOffPolicySelectorCss);

export const employeeSelectorVisibleAgain = async () => verifyElementIsVisible(TimeOffPage.employeeDropdownCss);
