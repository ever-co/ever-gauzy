import dayjs from 'dayjs';
import { expect } from '@playwright/test';
import {
	enterInput,
	verifyElementIsVisible,
	clickElementByText,
	enterInputConditionally,
	clearField,
	clickKeyboardBtnByKeycode,
	waitElementToHide,
	verifyText,
	verifyTextNotExisting,
	dispatchClick,
	waitForSpinnerGone,
	uploadImageThroughUploader
} from '../util';
import { selectNgOption } from '../ng-select';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { ManageEmployeesPage } from '../../../src/support/Base/pageobjects/ManageEmployeesPageObject';

// INVITE EMPLOYEE BY EMAIL
export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const inviteButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.inviteButtonCss);
};

export const clickInviteButton = async () => {
	// Toolbar Invite -> invite() opens the dialog. Settle then dispatch so a mid-transition
	// coordinate click can't land on a fading overlay and miss the handler.
	await waitForSpinnerGone();
	await dispatchClick(ManageEmployeesPage.inviteButtonCss);
};

export const emailInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.emailsInputCss);
};

export const enterEmailData = async (data) => {
	await enterInputConditionally(ManageEmployeesPage.emailsInputCss, data);
};

export const dateInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.dateInputCss);
};

// Add-Employee dialog's start-work date (scoped to ga-employee-mutation — see employeeDateInputCss).
export const employeeDateInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.employeeDateInputCss);
};

export const enterEmployeeDateData = async () => {
	await clearField(ManageEmployeesPage.employeeDateInputCss);
	await enterInput(ManageEmployeesPage.employeeDateInputCss, dayjs().format('MMM D, YYYY'));
};

export const enterDateData = async () => {
	await clearField(ManageEmployeesPage.dateInputCss);
	const date = dayjs().format('MMM D, YYYY');
	await enterInput(ManageEmployeesPage.dateInputCss, date);
	// NOTE: the caller follows this with clickKeyboardButtonByKeyCode(9) (Tab), which blurs the
	// [nbDatepicker] input and closes its calendar overlay before the next field is filled. We do NOT
	// press Escape here — nb-dialog opens with closeOnEsc:true, so an Escape when no calendar is open
	// would dismiss the whole invite/employee dialog.
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const selectProjectDropdownVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.selectProjectDropdownCss);
};

export const clickProjectDropdown = async () => {
	// #projectSelection is an ng-select that opens on mousedown and is blocked by the dialog
	// backdrop; a force coordinate click can also close the form. Open it via keyboard instead.
	const input = getPage()
		.locator(ManageEmployeesPage.selectProjectDropdownCss)
		.locator('input')
		.first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const selectProjectFromDropdown = async (text) => {
	await clickElementByText(
		ManageEmployeesPage.selectProjectDropdownOptionCss,
		text
	);
	// #projectSelection is a [multiple] ng-select with closeOnSelect=false and appendTo="body", so
	// after picking an option its ng-dropdown-panel stays OPEN, leaving a body-level overlay covering
	// the dialog footer. The next-step #firstName form then never opens because the invite dialog's
	// Submit was effectively shielded by that open panel (confirmed in the failure DOM: the invite
	// dialog stayed open with the project selected). Blur the ng-select input to close the panel
	// (selection persists; unlike Escape this can't bubble up to dismiss the nb-dialog) so the footer
	// is clear before we Submit.
	await getPage()
		.locator(ManageEmployeesPage.selectProjectDropdownCss)
		.locator('input')
		.first()
		.blur()
		.catch(() => {});
	await getPage().waitForTimeout(300);
};

export const sendInviteButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.sendInviteButtonCss);
};

export const clickSendInviteButton = async () => {
	// The invite dialog footer Submit can sit under the still-open project ng-select panel (body-level
	// overlay); a coordinate force-click lands on the overlay and the dialog never closes (next step's
	// #firstName form then never opens). Dispatch the click to the element so (click)="add()" fires
	// regardless of any overlay, then confirm the dialog actually detached — retry once if a transient
	// overlay swallowed the first dispatch.
	// The redesigned footer button is [disabled]="emailInviteForm.form.invalid" and NbButton swallows clicks
	// on a disabled host, so gate on it being enabled (both emails registered as tags) before dispatching.
	await waitForSpinnerGone();
	const page = getPage();
	const dialog = page.locator('ga-invite-mutation').first();
	const send = page.locator(ManageEmployeesPage.sendInviteButtonCss).first();
	for (let attempt = 0; attempt < 2; attempt++) {
		if (!(await send.isVisible().catch(() => false))) break; // dialog already closed
		await expect(send).toBeEnabled({ timeout: 24_000 });
		await send.dispatchEvent('click');
		try {
			await dialog.waitFor({ state: 'detached', timeout: 8000 });
			return;
		} catch {
			// dialog still open (POST in flight or first dispatch lost) — settle and retry once
			await waitForSpinnerGone();
			await page.waitForTimeout(500);
		}
	}
	// add() closes the dialog only once the invites were saved; a dialog that is still open means the
	// invite was not sent — report it here (with the toast) instead of in the next step's Add dialog.
	const closed = await dialog
		.waitFor({ state: 'detached', timeout: 8000 })
		.then(() => true)
		.catch(() => false);
	if (!closed) {
		const toast = (await page.locator('nb-toast').allInnerTexts().catch(() => [] as string[])).join(' | ');
		throw new Error(`Invite dialog did not close after "Send": the invites were not sent.${toast ? ` Toast: ${toast}` : ''}`);
	}
};

// ADD NEW EMPLOYEE
export const addEmployeeButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.addEmployeeButtonCss);
};

export const clickAddEmployeeButton = async () => {
	// Clicked right after the invite dialog closes; its fading cdk-overlay backdrop intercepts a
	// coordinate click. Dispatch the click so add() fires and the mutation stepper opens.
	await waitForSpinnerGone();
	await dispatchClick(ManageEmployeesPage.addEmployeeButtonCss);
};

export const firstNameInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.firstNameInputCss);
};

export const enterFirstNameData = async (data) => {
	await enterInput(ManageEmployeesPage.firstNameInputCss, data);
};

export const lastNameInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.lastNameInputCss);
};

export const enterLastNameData = async (data) => {
	await enterInput(ManageEmployeesPage.lastNameInputCss, data);
};

export const usernameInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.usernameInputCss);
};

export const enterUsernameData = async (data) => {
	await enterInput(ManageEmployeesPage.usernameInputCss, data);
};

export const employeeEmailInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.emailInputCss);
};

export const enterEmployeeEmailData = async (data) => {
	await enterInput(ManageEmployeesPage.emailInputCss, data);
};

export const passwordInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.passwordInputCss);
};

export const enterPasswordInputData = async (data) => {
	await enterInput(ManageEmployeesPage.passwordInputCss, data);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.addTagsDropdownCss);
};

export const clickTagsDropdown = async () => {
	// ga-tags-color-input is an ng-select that opens on MOUSEDOWN and is backdrop-blocked; a
	// force-click on its control can also close the add form. Open it via keyboard instead.
	const input = getPage()
		.locator(ManageEmployeesPage.addTagsDropdownCss)
		.locator('input')
		.first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const selectTagFromDropdown = async (index) => {
	// Routed through the ONE shared ng-select driver (tests/support/ng-select.ts). It counts only REAL
	// options: a bare `div.ng-option` ALSO matches ng-select's disabled "No items found" / "Loading…"
	// rows, so the old wait-then-click was satisfied by an EMPTY list and then clicked a row ng-select
	// ignores — a silent no-op that left this field unset. It re-opens the panel via the control's own
	// container until real options render (NEVER Escape: nb-dialog opens with closeOnEsc and that closed
	// the whole form), and it confirms the pick against `div.ng-value`, the only node that exists once a
	// value is really bound. Still best-effort — the tag is optional here — but it can no longer
	// half-succeed, and it can no longer kill the dialog on a slow list.
	await selectNgOption(ManageEmployeesPage.addTagsDropdownCss, ManageEmployeesPage.tagsDropdownOption, index);
};

// Close the body-appended tags ng-select panel (closeOnSelect=false leaves it open after the pick).
// ng-select closes on a document-level "click" whose press did not start inside the select/panel, so
// a mousedown+click dispatched on the dialog's own header title closes it — no coordinate click that
// could land on a form control in the middle of the (now much taller) dialog body, a datepicker, or
// the nb-dialog backdrop (closeOnBackdropClick would dismiss the whole form).
export const closeEmployeeDialogDropdowns = async () => {
	const page = getPage();
	const title = page.locator(ManageEmployeesPage.employeeDialogTitleCss).first();
	await title.dispatchEvent('mousedown').catch(() => undefined);
	await title.dispatchEvent('click').catch(() => undefined);
	await page
		.locator('ng-dropdown-panel')
		.first()
		.waitFor({ state: 'detached', timeout: 3000 })
		.catch(() => undefined);
};

// The user sets the new employee's picture. The image-URL text input this step used to fill is gone:
// #10336 (a73de1d121) turned the basic-info form's picture into an <ngx-image-uploader> avatar, so the
// picture is now chosen as a FILE and uploaded straight away (see util.uploadImageThroughUploader, which
// fails here if the picker never fires its upload). The upload result is deliberately not asserted: the
// picture is optional for the employee, and a later file-storage scenario can point the tenant at an
// unreachable S3 bucket. Either way the form stays valid — on success imageUrl gets the asset's URL
// (and is disabled, so its onerror hook can't flip the form invalid), on failure it stays null.
export const uploadEmployeeImage = async (): Promise<boolean> =>
	uploadImageThroughUploader(ManageEmployeesPage.employeeImageUploaderScopeCss);

// Re-fill the THREE controls that gate step-1 validity (firstName, email, password) right before we
// advance. The basic-info form is [disabled]="userBasicInfo.form.invalid"; if any one of these didn't
// register on its first fill (e.g. the password fill landed on the date-picker overlay, or an earlier
// field's valueChanges re-rendered the input), the form stays invalid, add()'s addEmployee() skips the
// push and createBulk([]) persists nothing — the empty grid at verifyEmployeeExists. Scope to the
// dialog so we don't hit a leftover overlay with the same id (strict-mode), and fire input+blur on the
// password so its ControlValueAccessor + reactive [formControl] both pick the value up.
export const reEnterRequiredStep1Fields = async (firstName, email, password) => {
	const dialog = getPage().locator('ga-employee-mutation').first();
	await dialog.locator(ManageEmployeesPage.firstNameInputCss).first().fill(String(firstName)).catch(() => {});
	await dialog.locator(ManageEmployeesPage.emailInputCss).first().fill(String(email)).catch(() => {});
	const pwd = dialog.locator(ManageEmployeesPage.passwordInputCss).first();
	await pwd.fill(String(password)).catch(() => {});
	await pwd.blur().catch(() => {});
};

// ---- Add-Employee stepper (redesigned dialog, #10336 / a73de1d121) ---------------------------------
// The stepper's own header and the per-step nbStepperNext buttons are gone: the step bar lives in the
// card header (the active `div.step` carries aria-current="step") and every action button sits in
// `nb-card-footer.dialog-footer`. See ManageEmployeesPage.nextButtonCss for the footer per step.

const employeeStep = (index: number) =>
	getPage().locator(ManageEmployeesPage.employeeStepIndicatorCss).nth(index);

const isEmployeeStepActive = async (index: number): Promise<boolean> =>
	(await employeeStep(index)
		.getAttribute('aria-current', { timeout: 2000 })
		.catch(() => null)) === 'step';

// Click the footer's primary "Continue" of the CURRENT step and prove the step bar moved to `toIndex`.
// The button is gated on `toBeEnabled` first: on step 0 it is [disabled] while the basic-info form is
// invalid, and NbButton swallows clicks on a disabled host, so clicking early would be a silent no-op.
// Waiting for it to be enabled makes a genuinely invalid form fail HERE (with the reason visible in the
// form) instead of as an empty employees grid much later. Dispatched (not coordinate-clicked) because a
// toast or the body-appended tags panel can sit over the footer.
const continueEmployeeStepper = async (buttonCss: string, toIndex: number) => {
	await waitForSpinnerGone();
	const button = getPage().locator(buttonCss).first();
	for (let attempt = 0; attempt < 3; attempt++) {
		if (await isEmployeeStepActive(toIndex)) return;
		await expect(button).toBeEnabled({ timeout: 24_000 });
		await button.dispatchEvent('click');
		const reached = await expect(employeeStep(toIndex))
			.toHaveAttribute('aria-current', 'step', { timeout: 6000 })
			.then(() => true)
			.catch(() => false);
		if (reached) return;
		await waitForSpinnerGone();
	}
	await expect(employeeStep(toIndex)).toHaveAttribute('aria-current', 'step', { timeout: 6000 });
};

export const nextButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.nextButtonCss);
};

// Step 0 "Details" -> step 1 "Add more".
export const clickNextButton = async () => {
	await continueEmployeeStepper(ManageEmployeesPage.nextButtonCss, 1);
};

export const nextStepButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.nextStepButtonCss);
};

// Step 1 "Add more" -> step 2 "Review". Deliberately the primary Continue, never step 1's
// "Add Another Employee" (addEmployee(): queues the entry and resets the form/stepper, persists nothing).
export const clickNextStepButton = async () => {
	await continueEmployeeStepper(ManageEmployeesPage.nextStepButtonCss, 2);
};

export const lastStepButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.lastStepButtonCss);
};

// Step 2 "Review": "Create employees (n)" -> (click)="add()" -> createBulk(), then closeDialog(employees)
// — the ONLY path that persists the employee. It is [disabled]="loading || pendingCount === 0", so wait
// for it to be enabled (pendingCount 0 would mean the form went invalid), dispatch, and require the dialog
// to detach: a createBulk failure (duplicate email/username, API error) keeps the dialog open — add() has
// already reset the stepper to step 0 by then — and shows an error toast, which is reported here instead
// of surfacing later as a missing employee.
export const clickLastStepButton = async () => {
	const page = getPage();
	await waitForSpinnerGone();
	const create = page.locator(ManageEmployeesPage.lastStepButtonCss).first();
	const dialog = page.locator('ga-employee-mutation').first();
	for (let attempt = 0; attempt < 2; attempt++) {
		if (!(await create.isVisible().catch(() => false))) break; // add() already ran (dialog reset or closed)
		await expect(create).toBeEnabled({ timeout: 24_000 });
		await create.dispatchEvent('click');
		const closed = await dialog
			.waitFor({ state: 'detached', timeout: 30_000 })
			.then(() => true)
			.catch(() => false);
		if (closed) return;
		await waitForSpinnerGone();
	}
	const closed = await dialog
		.waitFor({ state: 'detached', timeout: 5000 })
		.then(() => true)
		.catch(() => false);
	if (!closed) {
		const toast = (await page.locator('nb-toast').allInnerTexts().catch(() => [] as string[])).join(' | ');
		throw new Error(
			`Add Employee dialog did not close after "Create employees": the employee was not created.${toast ? ` Toast: ${toast}` : ''}`
		);
	}
};

// EDIT EMPLOYEE

export const tableRowVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.selectTableRowCss);
};

// Clear EVERY filter in the smart-table filter row (tr.angular2-smart-filters) so a stale sibling
// filter left by an earlier spec on the shared serial DB can't AND-out our record. The failure DOM
// proved this: the grid showed "You have not created any employees." with the Full Name filter holding
// a partial "an", the Email filter "En", and the Tags ng-select "Default" — an over-constrained AND
// query that hid a row that WAS created. We clear:
//   - every text <input> filter (Full Name / Email / Invited-By), and
//   - every ng-select filter's "clear all" (the Tags "Default" chip, Status, etc.)
// best-effort (swallow errors) — a column with no active filter simply has nothing to clear.
const clearAllGridFilters = async () => {
	const page = getPage();
	const filterRow = page.locator('tr.angular2-smart-filters').first();
	// Text inputs: select-all + Delete fires the InputFilterComponent's (keyup) so the filter actually
	// resets (a raw .fill('') dispatches only 'input', which that component ignores — it listens on keyup).
	const inputs = filterRow.locator('input[type="text"], input:not([type])');
	const inputCount = await inputs.count().catch(() => 0);
	for (let i = 0; i < inputCount; i++) {
		const inp = inputs.nth(i);
		const val = await inp.inputValue().catch(() => '');
		if (val) {
			await inp.click({ force: true }).catch(() => {});
			await inp.press('Control+a').catch(() => {});
			await inp.press('Delete').catch(() => {});
			await inp.press('Backspace').catch(() => {}); // in case selection was lost
		}
	}
	// ng-select filters (Tags / Status): click their "clear all" cross if a value is selected.
	const clears = filterRow.locator('ng-select .ng-clear-wrapper');
	const clearCount = await clears.count().catch(() => 0);
	for (let i = 0; i < clearCount; i++) {
		await clears.nth(i).click({ force: true }).catch(() => {});
	}
	await page.waitForTimeout(700); // let the debounced refetch(es) land
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
};

// Drive one smart-table column filter reliably. The angular2-smart-table InputFilterComponent reacts on
// (keyup)/(change), NOT (input), and re-renders the whole filter row on each debounced refetch — so a
// plain Playwright .fill() (which dispatches 'input' and can be clobbered mid-type by the re-render)
// leaves a partial value (the observed "an"). Type char-by-char via pressSequentially (real keyups),
// then read the value back and retry (re-locating a fresh input each time) until it sticks.
const applyColumnFilter = async (inputCss: string, value: string) => {
	const page = getPage();
	for (let attempt = 0; attempt < 4; attempt++) {
		const input = page.locator(inputCss).first();
		await input.click({ force: true }).catch(() => {});
		await input.press('Control+a').catch(() => {});
		await input.press('Delete').catch(() => {});
		await input.pressSequentially(String(value), { delay: 40 }).catch(() => {});
		// smart-table filtering is debounced (300ms) + server-side; let the refetch land.
		await page.waitForTimeout(1500);
		await waitForSpinnerGone();
		await page.waitForLoadState('networkidle').catch(() => {});
		const current = await page.locator(inputCss).first().inputValue().catch(() => '');
		if (current === String(value)) return; // value stuck -> filter applied
	}
};

// Filter the employees grid by Full Name so the created employee is the only data row (row 0). The
// fresh seed renders Super Admin + Default Employee ahead of any new employee, so a blind row-0 click
// would select a seeded admin (whose End Work button never renders — "Not Started") and the chain
// would stall. Clear any polluting sibling filters first, then apply the Full Name filter robustly.
export const searchEmployeeByName = async (name) => {
	const page = getPage();
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await clearAllGridFilters();
	await applyColumnFilter(ManageEmployeesPage.nameFilterInputCss, String(name));
};

// Filter the invites grid by email so THIS spec's invite is the only/first data row (pollution-safe).
// The invites grid accumulates earlier specs' invites on the shared serial DB, and the Copy/Resend
// buttons only render for an INVITED-status row — a blind row-0 pick could land on a non-INVITED invite.
// Clear stale sibling filters (Invited-By text, Status ng-select) first, then apply the Email filter.
export const searchInviteByEmail = async (email) => {
	const page = getPage();
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await clearAllGridFilters();
	await applyColumnFilter(ManageEmployeesPage.inviteEmailFilterInputCss, String(email));
};

export const selectTableRow = async (index) => {
	// Selecting a grid row TOGGLES selection and enables the toolbar (Edit/End Work/Delete, or the
	// Copy/Resend/Delete buttons on the invites grid). Settle the grid first so the click lands on the
	// rendered row, then click ONCE and poll a toolbar button to confirm selection stuck — a rapid
	// re-click would toggle the selection back off; only re-click if the first click was lost to a
	// late re-render (mirrors the proven ContactsLeads.selectTableRow).
	const page = getPage();
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const row = page.locator(ManageEmployeesPage.selectTableRowCss).nth(index);
	const editBtn = page.locator(ManageEmployeesPage.editEmployeeButtonCss).first();
	for (let attempt = 0; attempt < 4; attempt++) {
		await row.click({ force: true });
		for (let i = 0; i < 8; i++) {
			await page.waitForTimeout(350);
			// On the employees grid the Edit button enabling confirms the row is selected. On the
			// invites grid Edit doesn't exist, so this poll falls through after one attempt and the
			// single click above already toggled selection (Copy/Resend/Delete then become visible).
			if (await editBtn.isVisible().catch(() => false)) {
				if (!(await editBtn.isDisabled().catch(() => true))) return;
			} else {
				return; // no Edit button (invites grid) — single click is enough
			}
		}
	}
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.editEmployeeButtonCss);
};

export const clickEditButton = async () => {
	// Toolbar Edit fires after row selection; dispatch so a fading selection/overlay can't swallow it.
	await dispatchClick(ManageEmployeesPage.editEmployeeButtonCss);
};

export const usernameEditInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.usernameEditSecondInputCss);
};

export const enterUsernameEditInputData = async (data) => {
	await clearField(ManageEmployeesPage.usernameEditSecondInputCss);
	await enterInput(ManageEmployeesPage.usernameEditSecondInputCss, data);
};

export const emailEditInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.emailEditSecondInputCss);
};

export const enterEmailEditInputData = async (data) => {
	await clearField(ManageEmployeesPage.emailEditSecondInputCss);
	await enterInput(ManageEmployeesPage.emailEditSecondInputCss, data);
};

export const firstNameEditInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.firstNameSecondEditInputCss);
};

export const enterFirstNameEditInputData = async (data) => {
	await clearField(ManageEmployeesPage.firstNameSecondEditInputCss);
	await enterInput(ManageEmployeesPage.firstNameSecondEditInputCss, data);
};

export const lastNameEditInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.lastNameSecondEditInputCss);
};

export const enterLastNameEditInputData = async (data) => {
	await clearField(ManageEmployeesPage.lastNameSecondEditInputCss);
	await enterInput(ManageEmployeesPage.lastNameSecondEditInputCss, data);
};

export const preferredLanguageDropdownVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.preferredLanguageDropdownCss);
};

export const clickPreferredLanguageDropdown = async () => {
	// ngx-language-selector is an ng-select that opens on MOUSEDOWN and is backdrop-blocked; a
	// force-click on its control can also close the form. Open it via keyboard instead.
	const input = getPage()
		.locator(ManageEmployeesPage.preferredLanguageDropdownCss)
		.locator('input')
		.first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const selectLanguageFromDropdown = async (text) => {
	await clickElementByText(ManageEmployeesPage.preferredLanguageOptionCss, text);
};

export const saveEditButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.saveEditButtonCss);
};

export const clickSaveEditButton = async () => {
	// Edit-page Save (disabled while form invalid). Settle, then dispatch so (click)="submitForm()"
	// fires even with a transient overlay/spinner from the language ng-select we just closed. It is
	// [disabled]="form.invalid" and NbButton swallows clicks while disabled, so wait for it to be enabled
	// first — an invalid account form then fails here instead of silently skipping the save.
	await waitForSpinnerGone();
	await expect(getPage().locator(ManageEmployeesPage.saveEditButtonCss).first()).toBeEnabled({ timeout: 24_000 });
	await dispatchClick(ManageEmployeesPage.saveEditButtonCss);
};

export const backButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.backButtonCss);
};

export const clickBackButton = async () => {
	// Clicked right after the edit Save toast; dispatch through any lingering overlay.
	await dispatchClick(ManageEmployeesPage.backButtonCss);
};

// END WORK

export const endWorkButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.endWorkButtonCss);
};

export const clickEndWorkButton = async () => {
	// Toolbar End Work (after row selection) opens the confirm dialog; dispatch through any fading
	// selection overlay so (click)="endWork(...)" fires.
	await dispatchClick(ManageEmployeesPage.endWorkButtonCss);
};

export const confirmEndWorkButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.confirmEndWorkButtonCss);
};

export const clickConfirmEndWorkButton = async () => {
	// Confirm on the freshly-opened End Work dialog; dispatch so its own backdrop can't intercept.
	await dispatchClick(ManageEmployeesPage.confirmEndWorkButtonCss);
};

// DELETE EMPLOYEE

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.deleteEmployeeButtonCss);
};

export const clickDeleteButton = async () => {
	// Toolbar Delete (after row selection) opens the confirm dialog; dispatch through any fading
	// selection overlay.
	await dispatchClick(ManageEmployeesPage.deleteEmployeeButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	// Confirm on the freshly-opened Delete dialog; dispatch so its own backdrop can't intercept.
	await dispatchClick(ManageEmployeesPage.confirmDeleteButtonCss);
};

// COPY INVITE LINK

export const manageInvitesButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.manageInvitesButtonCss);
};

export const clickManageInviteButton = async () => {
	// Header "Manage Invites" routerLink button; clicked after the delete toast, dispatch through
	// any lingering overlay.
	await waitForSpinnerGone();
	await dispatchClick(ManageEmployeesPage.manageInvitesButtonCss);
};

export const copyLinkButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.copyLinkButtonCss);
};

export const clickCopyLinkButton = async () => {
	// Toolbar Copy Link (after row selection); dispatch through any fading selection overlay.
	await dispatchClick(ManageEmployeesPage.copyLinkButtonCss);
};

// RESEND INVITE

export const resendInviteButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.resendInviteButtonCss);
};

export const clickResendInviteButton = async () => {
	// Toolbar Resend (after row selection) opens the confirm dialog; dispatch through any fading
	// selection overlay.
	await dispatchClick(ManageEmployeesPage.resendInviteButtonCss);
};

export const confirmResendInviteButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.confirmResendInviteButtonCss);
};

export const clickConfirmResendInviteButton = async () => {
	// OK on the freshly-opened resend dialog; dispatch so its own backdrop can't intercept.
	await dispatchClick(ManageEmployeesPage.confirmResendInviteButtonCss);
};

// DELETE INVITE

export const deleteInviteButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.deleteInviteButtonCss);
};

export const clickDeleteInviteButton = async () => {
	// Toolbar Delete invite (after row selection) opens the confirm dialog; dispatch through any
	// fading selection overlay.
	await dispatchClick(ManageEmployeesPage.deleteInviteButtonCss);
};

export const confirmDeleteInviteButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.confirmDeleteInviteButtonCss);
};

// The invite delete dialog is type-to-confirm since #10761 (699b3c7187): its Delete stays [disabled] until
// the invitee's email (case-insensitive) is typed into #invite-delete-email. Typing it is how a user now
// confirms the deletion, so the step does the same.
export const enterDeleteInviteConfirmation = async (email) => {
	const input = getPage().locator(ManageEmployeesPage.deleteInviteConfirmInputCss).first();
	await input.waitFor({ state: 'visible', timeout: 24_000 });
	await input.fill(String(email).trim());
};

export const clickConfirmDeleteInviteButton = async () => {
	// Delete on the freshly-opened dialog: wait until the typed confirmation enabled it (NbButton swallows
	// clicks while disabled), dispatch so its own backdrop can't intercept, then require the dialog to close.
	const page = getPage();
	const confirm = page.locator(ManageEmployeesPage.confirmDeleteInviteButtonCss).first();
	await expect(confirm).toBeEnabled({ timeout: 24_000 });
	await confirm.dispatchEvent('click');
	await page.locator('ga-invite-delete-confirmation').first().waitFor({ state: 'detached', timeout: 24_000 });
};

export const waitMessageToHide = async () => {
	await waitElementToHide(ManageEmployeesPage.toastrMessageCss);
};

export const verifyEmployeeExists = async (text) => {
	// Pollution-resilient: the suite shares ONE seeded DB and runs serially, so by the time this spec
	// runs the org's grid can hold >10 employees from earlier specs and our just-created row may be on
	// page 2. Filter the grid by the unique full name first so the matching row is forced onto page 1
	// (server-side user.name filter) before asserting it's present.
	await searchEmployeeByName(text);
	await verifyText(ManageEmployeesPage.verifyEmployeeCss, text);
};

export const verifyEmployeeIsDeleted = async (text) => {
	// Filter by the unique name first, then assert the grid holds NO row with it (count 0 of that
	// name) — order-independent: a non-empty grid full of other specs' employees won't false-pass/fail.
	await searchEmployeeByName(text);
	await verifyTextNotExisting(ManageEmployeesPage.verifyEmployeeCss, text);
};

export const verifyInviteExists = async (text) => {
	await verifyText(ManageEmployeesPage.verifyInviteCss, text);
};

export const verifyInviteIsDeleted = async (text) => {
	await verifyTextNotExisting(ManageEmployeesPage.verifyInviteCss, text);
};
