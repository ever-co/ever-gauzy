import dayjs from 'dayjs';
import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	enterInputConditionally,
	clearField,
	clickKeyboardBtnByKeycode,
	waitElementToHide,
	verifyText,
	verifyTextNotExisting,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
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
	await waitForSpinnerGone();
	const dialog = getPage().locator('ga-invite-mutation').first();
	for (let attempt = 0; attempt < 2; attempt++) {
		await dispatchClick(ManageEmployeesPage.sendInviteButtonCss);
		try {
			await dialog.waitFor({ state: 'detached', timeout: 8000 });
			return;
		} catch {
			// dialog still open (POST in flight or first dispatch lost) — settle and retry once
			await waitForSpinnerGone();
			await getPage().waitForTimeout(500);
		}
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
	// Tags are OPTIONAL for the employee form's validity, so make this best-effort: if the ng-select
	// panel has an option, pick it; if it didn't open / has no options (e.g. the tags grid wasn't
	// seeded yet), Escape and continue rather than throwing and breaking the whole add flow.
	const page = getPage();
	const option = page.locator(ManageEmployeesPage.tagsDropdownOption).nth(index);
	const appeared = await option
		.waitFor({ state: 'visible', timeout: 8000 })
		.then(() => true)
		.catch(() => false);
	if (appeared) {
		await option.click({ force: true }).catch(() => {});
	} else {
		await page.keyboard.press('Escape').catch(() => {});
	}
};

export const clickCardBody = async () => {
	await clickButton(ManageEmployeesPage.cardBodyCss);
};

export const imageInputVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.imgInputCss);
};

export const enterImageDataUrl = async (url) => {
	await enterInput(ManageEmployeesPage.imgInputCss, url);
};

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

export const nextButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.nextButtonCss);
};

export const clickNextButton = async () => {
	// Stepper step-1 -> step-2 (nbStepperNext). The tags ng-select we just opened (appendTo body)
	// leaves a fading overlay over the footer; dispatch straight on the button.
	// IMPORTANT: this button is [disabled]="userBasicInfo.form.invalid". A dispatchEvent('click') fires
	// the nbStepperNext host listener even on a DISABLED button, so a still-invalid step-1 form would be
	// silently force-advanced to step-3, where add()'s addEmployee() skips the push (form invalid) and
	// createBulk([]) persists nothing — the exact empty-grid failure. Wait for the button to actually be
	// ENABLED (form valid) before advancing so a real validity problem surfaces here instead of as a
	// mysterious empty grid downstream.
	await waitForSpinnerGone();
	const next = getPage().locator(ManageEmployeesPage.nextButtonCss).first();
	await next
		.waitFor({ state: 'visible', timeout: 8000 })
		.catch(() => {});
	// Poll until the form is valid (Next no longer disabled). The spec re-fills the required fields
	// (reEnterRequiredStep1Fields) right before this, so validity should be reached quickly; only after
	// it's genuinely enabled do we advance, so we never force-advance an invalid form into an empty
	// createBulk([]).
	for (let i = 0; i < 30; i++) {
		if (!(await next.isDisabled().catch(() => true))) break;
		await getPage().waitForTimeout(500);
	}
	await dispatchClick(ManageEmployeesPage.nextButtonCss);
};

export const nextStepButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.nextStepButtonCss);
};

export const clickNextStepButton = async () => {
	// Stepper step-2 -> step-3 (nbStepperNext); same backdrop hazard as step-1's Next.
	// IMPORTANT: step 2 has BOTH a green "Next" (nbStepperNext) AND a status="success" "Add Another
	// Employee" (addEmployee(), which pushes then RESETS the form/stepper and NEVER persists). We must
	// actually reach step 3 before clicking the persist button — otherwise the later status="success"
	// click hits "Add Another Employee" and the employee is silently never created (empty grid). Dispatch
	// step-2's Next, then confirm the step-3 finish button ("Added All Current Employees") appears; retry
	// the dispatch if the first didn't take.
	await waitForSpinnerGone();
	const finish = getPage().locator(ManageEmployeesPage.lastStepButtonCss).first();
	for (let attempt = 0; attempt < 3; attempt++) {
		await dispatchClick(ManageEmployeesPage.nextStepButtonCss);
		const reached = await finish
			.waitFor({ state: 'visible', timeout: 6000 })
			.then(() => true)
			.catch(() => false);
		if (reached) return;
		await waitForSpinnerGone();
	}
};

export const lastStepButtonVisible = async () => {
	await verifyElementIsVisible(ManageEmployeesPage.lastStepButtonCss);
};

export const clickLastStepButton = async () => {
	// Stepper step-3 "I've Added All Current Employees" -> (click)="add()" calls createBulk() and closes
	// the dialog — the ONLY path that persists the employee. Dispatch through any lingering stepper/overlay
	// backdrop, then confirm the mutation dialog actually detached (createBulk resolved). Retry once if a
	// transient overlay swallowed the first dispatch, so we never leave with nothing persisted.
	await waitForSpinnerGone();
	const dialog = getPage().locator('ga-employee-mutation').first();
	for (let attempt = 0; attempt < 2; attempt++) {
		await dispatchClick(ManageEmployeesPage.lastStepButtonCss);
		const closed = await dialog
			.waitFor({ state: 'detached', timeout: 12000 })
			.then(() => true)
			.catch(() => false);
		if (closed) return;
		await waitForSpinnerGone();
		await getPage().waitForTimeout(500);
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
	// fires even with a transient overlay/spinner from the language ng-select we just closed.
	await waitForSpinnerGone();
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

export const clickConfirmDeleteInviteButton = async () => {
	// OK on the freshly-opened delete dialog; dispatch so its own backdrop can't intercept.
	await dispatchClick(ManageEmployeesPage.confirmDeleteInviteButtonCss);
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
