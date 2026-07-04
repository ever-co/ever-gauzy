import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickButtonByIndex,
	waitElementToHide,
	clickElementByText,
	verifyText,
	verifyElementNotExist,
	verifyTextNotExisting,
	waitUntil,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { GoalsPage } from '../../../src/support/Base/pageobjects/GoalsPageObject';

export const addButtonVisible = async () => {
	await verifyElementIsVisible(GoalsPage.addButtonCss);
};

// Open the "Add new Objective" nbPopover and confirm its "Create new" list actually rendered.
// Returns true once the popover list is visible, false if every trigger attempt failed.
//
// Why this is finicky (root cause of the round-6 regression): "Add new Objective" uses
// nbPopoverTrigger="click" with NO explicit (click) handler, so it opens ONLY via Nebular's
// NbClickTriggerStrategy — `fromEvent(document,'click')` mapped to `[!container() && isOnHost(target)]`.
// That stream is a TOGGLE: a host click with no open container SHOWS, a host click while the container
// is open HIDES. The button also sits inside gauzy-button-action's `.transition` span, which is offset
// by a CSS `transform: translateX()` and clipped by an `overflow-x:hidden` parent, so a {force:true}
// coordinate click hit-tests to the clipping/transformed ancestor (isOnHost=false → never opens).
// The previous 3-attempt dispatch loop keyed re-dispatch off the *list-item* visibility, which flickers
// during the overlay open animation — a flicker made it re-dispatch and TOGGLE the just-opened popover
// shut, and with only 3 attempts it could end on a closed toggle (the observed failure: the popover
// never present when selectOptionFromDropdown asserted it).
//
// This helper fixes that by:
//   - keying "is it open?" off the popover OVERLAY pane (nb-popover), which is stable, not the animating
//     list item, so we never re-trigger a popover that already opened (no accidental toggle-closed);
//   - trying BOTH a real (non-force) .click() — which properly hit-tests the on-screen button and fires
//     Nebular's real document click reliably — AND a dispatchEvent('click') straight to the button
//     (event.target = button → isOnHost matches, bubbles to document), alternating across attempts so a
//     transform/clip that defeats one path is covered by the other.
const openObjectivePopover = async (): Promise<boolean> => {
	const page = getPage();
	await waitForSpinnerGone();
	const button = page.locator(GoalsPage.addButtonCss).first();
	await button.waitFor({ state: 'attached', timeout: 24000 }).catch(() => {});
	// Root cause of the round-7 failure (popover NEVER opens across ~12 attempts, button clearly on-screen
	// in the dump): Nebular's nbPopoverTrigger="click" is a TOGGLE driven by document clicks, gated on
	// `!container() && isOnHost(event.target)`. Two things defeated the old loop:
	//   1. A real Playwright .click() hit-tests the button's box, but the button lives inside
	//      gauzy-button-action's `.transition-container` (overflow-x:hidden) whose child `.transition` is
	//      offset by a translateX() transform. The point the click lands on can hit-test to that
	//      transformed/clipped ANCESTOR, so event.target != host button -> isOnHost=false -> NO show (and
	//      if a container were open, it counts as an outside click -> HIDE). So the real-click attempts are
	//      no-ops here.
	//   2. Alternating real-click / dispatch across attempts could also toggle a just-opened popover shut.
	// Fix: ONLY dispatch the click straight to the button (event.target = button -> isOnHost=true ->
	// deterministic SHOW), and make every dispatch happen from a known-CLOSED state: if a stray overlay is
	// half-open, dismiss it first (outside click) and wait for `nb-popover` to detach, so `!container()`
	// holds at dispatch time. Key "open" off the stable nb-popover overlay + its list item.
	const pane = page.locator('nb-popover');
	const list = page.locator(GoalsPage.optionDropdownCss).first();
	for (let attempt = 0; attempt < 8; attempt++) {
		if (await list.isVisible().catch(() => false)) {
			return true;
		}
		const paneAttached = (await pane.count().catch(() => 0)) > 0;
		if (paneAttached) {
			// A popover overlay is attached but its list item still isn't visible — give the CDK overlay a
			// moment to finish rendering the nb-list before deciding to re-trigger.
			if (await list.waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false)) {
				return true;
			}
			// Still no list: dismiss this (possibly wrong/empty) overlay from a known-closed baseline before
			// re-dispatching, so the next dispatch is a guaranteed SHOW (not a toggle-shut). Dispatch the
			// click on <body> itself (event.target = body -> NOT on host/container -> Nebular's hide$ fires),
			// which closes the popover WITHOUT a coordinate click that could land on the sidebar/logo and
			// navigate away.
			await page.locator('body').dispatchEvent('click').catch(() => {});
			await pane.first().waitFor({ state: 'detached', timeout: 4000 }).catch(() => {});
		}
		// Dispatch straight to the button: target = button, bubbles to document, isOnHost matches -> SHOW.
		await button.dispatchEvent('click').catch(() => {});
		await list.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
	}
	return await list.isVisible().catch(() => false);
};

export const clickAddButton = async (index, name?) => {
	// The Goals page shows a full-card nb-spinner over the toolbar right after navigation; wait it out
	// first so the toolbar is interactive.
	await waitForSpinnerGone();
	if (index === 0) {
		// index 0 = toolbar "Add new Objective" — open its nbPopover reliably (see openObjectivePopover).
		await openObjectivePopover();
		return;
	}
	// index 1 = "Add new Key Result" inside the EXPANDED accordion body (a different element, not an
	// nth() of the toolbar add button). When a unique goal name is supplied, scope the key-result add
	// button to OUR objective's body so we never hit another (polluting) objective's button.
	const selector = name ? GoalsPage.addKeyResultButtonByName(name) : GoalsPage.addKeyResultButtonCss;
	const button = getPage().locator(selector).first();
	await button.waitFor({ state: 'attached', timeout: 24000 }).catch(() => {});
	// "Add new Key Result" has a normal Angular (click)="addKeyResult(...)" host listener, which a
	// dispatched event triggers fine — dispatch past any fading post-mutation overlay.
	await button.dispatchEvent('click');
};

export const selectOptionFromDropdown = async (index) => {
	// The "Add new Objective" nb-popover renders as a CDK overlay on click. It can fail to open (or get
	// toggled shut) behind a fading backdrop, so SELF-HEAL: if the popover list isn't present, re-open it
	// before asserting — this is the step that actually depends on the "Create new" item being clickable.
	const list = getPage().locator(GoalsPage.optionDropdownCss);
	if (!(await list.first().isVisible().catch(() => false))) {
		await openObjectivePopover();
	}
	await verifyElementIsVisible(GoalsPage.optionDropdownCss);
	// Dispatch the click straight to the list item — a coordinate click can land on the popover backdrop
	// rather than the "Create new" item.
	await list.nth(index).dispatchEvent('click');
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(GoalsPage.nameInputCss);
};

export const enterNameInputData = async (data) => {
	await clearField(GoalsPage.nameInputCss);
	await enterInput(GoalsPage.nameInputCss, data);
};

export const ownerDropdownVisible = async () => {
	await verifyElementIsVisible(GoalsPage.ownerDropdownCss);
};

export const clickOwnerDropdown = async () => {
	await clickButton(GoalsPage.ownerDropdownCss);
};

export const selectOwnerFromDropdown = async (index) => {
	// The objective form defaults to ORGANIZATION level, so the owner nb-select holds a single option
	// (the org). The spec passes the org NAME here but the underlying control is index-based; always
	// pick option 0 (the only one) so a stray non-numeric arg can't break the nth() lookup. Wait for the
	// nb-select overlay option to render first.
	const option = getPage().locator(GoalsPage.dropdownOptionCss);
	await option.first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
	await option.first().click({ force: true });
};

export const leadDropdownVisible = async () => {
	await verifyElementIsVisible(GoalsPage.leadDropdownCss);
};

export const clickLeadDropdown = async () => {
	await clickButton(GoalsPage.leadDropdownCss);
};

export const selectLeadFromDropdown = async (index) => {
	// Best-effort: the objective "Lead" is an employee multi-select whose options are the employees
	// "working" in the header date range (loaded async) and is frequently EMPTY on the test DB. Lead is
	// optional (leadId has no validator), so pick one if it renders, otherwise Escape and continue —
	// avoids a 60s hang on an empty list. Mirrors ContactsLeads.selectEmployeeDropdownOption.
	const page = getPage();
	const option = page.locator(GoalsPage.dropdownOptionCss);
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
	} catch {
		await page.keyboard.press('Escape').catch(() => {});
	}
};

export const deadlineDropdownVisible = async () => {
	await verifyElementIsVisible(GoalsPage.deadlineDropdownCss);
};

export const clickDeadlineDropdown = async () => {
	await clickButton(GoalsPage.deadlineDropdownCss);
};

export const selectDeadlineFromDropdown = async (index) => {
	// Deadline is a plain nb-select bound via formControlName, so picking any option both fills the
	// required control and enables Save. Wait for the overlay option to paint, then click it.
	const option = getPage().locator(GoalsPage.dropdownOptionCss);
	await option.first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
	await option.nth(index).click({ force: true });
};

export const confirmButtonVisible = async () => {
	await verifyElementIsVisible(GoalsPage.confirmButtonCss);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(GoalsPage.editButtonCss);
};

export const clickEditButton = async (index) => {
	await clickButtonByIndex(GoalsPage.editButtonCss, index);
};

export const viewButtonVisible = async () => {
	await verifyElementIsVisible(GoalsPage.viewButtonCss);
};

export const clickViewButton = async (index) => {
	await clickButtonByIndex(GoalsPage.viewButtonCss, index);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(GoalsPage.deleteButtonCss);
};

export const clickDeleteButton = async () => {
	await clickButton(GoalsPage.deleteButtonCss);
};

export const clickConfirmButton = async () => {
	// Save/confirm on a dialog footer: wait the card spinner out, then dispatch the click so a fading
	// cdk-overlay backdrop from the just-opened dialog can't swallow a coordinate click.
	await waitForSpinnerGone();
	await dispatchClick(GoalsPage.confirmButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(GoalsPage.toastrMessageCss);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(GoalsPage.tableRowCss);
};

export const clickTableRow = async (index, name?) => {
	// Settle after the preceding mutation/toastr (a fading cdk-overlay backdrop can swallow a coordinate
	// click on the accordion header), then dispatch the click straight to the row so onClickObjective +
	// the accordion expand reliably fire. The header click both selects the objective (enables the
	// toolbar View/Edit/Delete) and expands the body (reveals "Add new Key Result").
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => {});
	await waitUntil(1500);
	// IDEMPOTENT EXPAND: the header (click) TOGGLES both Nebular's accordion and the component's
	// selectedGoal, and loadPage() after each mutation never resets selectedGoal (it keeps a stale ref
	// with the SAME id) — so a single blind click may COLLAPSE an already-expanded item instead of
	// opening it. Click the header, then verify the expanded body button is visible; only re-click if it
	// isn't. Never rapid re-click (matches the row-selection playbook). When the body is open the
	// objective is also selected, which is what the edit/delete steps need.
	const page = getPage();
	// Dispatch on the accordion-item-HEADER, not the item: both onClickObjective and Nebular's expand
	// toggle are host (click) listeners on the header element, and a click dispatched on the parent item
	// doesn't reach them. POLLUTION RESILIENCE: when a unique goal name is supplied, target the header of
	// OUR objective (scoped by name) instead of nth(index) — the seed/serial run can carry other
	// objectives, so nth(0) is not guaranteed to be ours.
	const row = name
		? page.locator(GoalsPage.objectiveHeaderByName(name)).first()
		: page.locator(GoalsPage.verifyGoalCss).nth(index);
	await row.waitFor({ state: 'attached', timeout: 24000 }).catch(() => {});
	// The "expanded" signal must be OUR objective's add-key-result body button, not just any objective's.
	const body = name
		? page.locator(GoalsPage.addKeyResultButtonByName(name)).first()
		: page.locator(GoalsPage.addKeyResultButtonCss).first();
	for (let attempt = 0; attempt < 3; attempt++) {
		if (await body.isVisible().catch(() => false)) {
			return;
		}
		await row.dispatchEvent('click');
		await body.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
	}
};

export const keyResultRowVisible = async (name?) => {
	// Scope to OUR objective's key-result rows when a unique name is supplied (pollution resilience).
	await verifyElementIsVisible(name ? GoalsPage.keyResultRowByName(name) : GoalsPage.keyResultRowCss);
};

export const clickKeyResultRow = async (index, name?) => {
	// Selecting a key result is what swaps the toolbar from the objective actions to the key-result
	// actions (View / Edit / Weight%); the objective-header click alone never reveals those, so the
	// deadline (step 3) and weight (step 4) flows must select the key-result row first. The row (click)
	// also TOGGLES selectedKeyResult (with a stale same-id ref after loadPage), so do the same idempotent
	// poll as clickTableRow: dispatch the click, then confirm the key-result-only Weight% button appeared
	// (it never renders for an objective selection); only re-click if it didn't.
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => {});
	await waitUntil(1000);
	const page = getPage();
	// POLLUTION RESILIENCE: target the key-result row inside OUR objective's accordion body (scoped by
	// the unique goal name) rather than a global nth(index) across every objective on the seed.
	const row = name
		? page.locator(GoalsPage.keyResultRowByName(name)).nth(index)
		: page.locator(GoalsPage.keyResultRowCss).nth(index);
	await row.waitFor({ state: 'attached', timeout: 24000 }).catch(() => {});
	const keyResultToolbar = page.locator(GoalsPage.weightTypeButtonCss).first();
	for (let attempt = 0; attempt < 3; attempt++) {
		if (await keyResultToolbar.isVisible().catch(() => false)) {
			return;
		}
		await row.dispatchEvent('click');
		await keyResultToolbar.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
	}
};

export const ensureObjectiveSelected = async (index, name?) => {
	// The edit/delete steps need the OBJECTIVE actions template (Edit -> createObjective(selectedGoal),
	// View -> openGoalDetails). After the weight/deadline flows a KEY RESULT is still selected, so the
	// toolbar shows the key-result template (which also has an .action.primary Edit, but it edits the key
	// result). Click the objective header to toggle selectedGoal until the objective is truly selected.
	// Two robust signals (Playwright's isVisible is fooled by the toolbar's translateX/overflow hide):
	//   1. the key-result-only Weight% button is ABSENT  -> not the key-result template; and
	//   2. the objective Delete button's real `disabled` attr is gone -> selectedGoal.isSelected is true
	//      (it is bound [disabled]="!selectedGoal.isSelected", so it stays disabled when nothing/only a
	//      key result is selected). Idempotent, never rapid re-click.
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => {});
	await waitUntil(1500);
	const page = getPage();
	// POLLUTION RESILIENCE: toggle OUR objective's header (scoped by unique name), not nth(index).
	const header = name
		? page.locator(GoalsPage.objectiveHeaderByName(name)).first()
		: page.locator(GoalsPage.verifyGoalCss).nth(index);
	await header.waitFor({ state: 'attached', timeout: 24000 }).catch(() => {});
	const weightBtn = page.locator(GoalsPage.weightTypeButtonCss).first();
	const objectiveDelete = page.locator(GoalsPage.objectiveDeleteButtonCss).first();
	for (let attempt = 0; attempt < 4; attempt++) {
		const weightVisible = await weightBtn.isVisible().catch(() => false);
		const deleteDisabled = await objectiveDelete.getAttribute('disabled').catch(() => 'disabled');
		// disabled attr present (any value incl. '') => not selected; null => selected.
		if (!weightVisible && deleteDisabled === null) {
			return;
		}
		await header.dispatchEvent('click');
		await waitUntil(800);
	}
};

export const keyResultInputVisible = async () => {
	await verifyElementIsVisible(GoalsPage.keyResultInputCss);
};

export const enterKeyResultNameData = async (data) => {
	await clearField(GoalsPage.keyResultInputCss);
	await enterInput(GoalsPage.keyResultInputCss, data);
};

export const initialValueInputVisible = async () => {
	await verifyElementIsVisible(GoalsPage.initialValueCss);
};

export const enterInitialValueData = async (data) => {
	await clearField(GoalsPage.initialValueCss);
	await enterInput(GoalsPage.initialValueCss, data);
};

export const targetValueInputVisible = async () => {
	await verifyElementIsVisible(GoalsPage.targetValueCss);
};

export const enterTargetValueData = async (data) => {
	await clearField(GoalsPage.targetValueCss);
	await enterInput(GoalsPage.targetValueCss, data);
};

export const keyResultOwnerDropdownVisible = async () => {
	await verifyElementIsVisible(GoalsPage.keyResultOwnerCss);
};

export const clickKeyResultOwnerDropdown = async () => {
	await clickButton(GoalsPage.keyResultOwnerCss);
};

export const selectKeyResultOwnerFromDropdown = async (index) => {
	// Best-effort employee pick (same async/empty-list hazard as the objective lead). The key-result
	// owner IS required to save, but the option list loads async — wait up to ~8s, pick one if present,
	// else Escape so we never hard-hang 60s on an empty list.
	const page = getPage();
	const option = page.locator(GoalsPage.dropdownOptionCss);
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
	} catch {
		await page.keyboard.press('Escape').catch(() => {});
	}
};

export const keyResultLeadDropdownVisible = async () => {
	await verifyElementIsVisible(GoalsPage.keyResultLeadCss);
};

export const clickKeyResultLeadDropdown = async () => {
	await clickButton(GoalsPage.keyResultLeadCss);
};

export const selectKeyResultLeadFromDropdown = async (index) => {
	// Best-effort employee pick (lead is optional; same async/empty-list hazard).
	const page = getPage();
	const option = page.locator(GoalsPage.dropdownOptionCss);
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
	} catch {
		await page.keyboard.press('Escape').catch(() => {});
	}
};

export const toggleButtonVisible = async () => {
	await verifyElementIsVisible(GoalsPage.toggleButtonCss);
};

export const clickToggleButton = async () => {
	await clickButton(GoalsPage.toggleButtonCss);
};

export const addNewDeadlineButtonVisible = async () => {
	await verifyElementIsVisible(GoalsPage.addDeadlineButtonCss);
};

export const clickAddDeadlineButton = async () => {
	await clickButton(GoalsPage.addDeadlineButtonCss);
};

export const updatedValueInputVisible = async () => {
	await verifyElementIsVisible(GoalsPage.updatedValueCss);
};

export const enterUpdatedValueData = async (data) => {
	await clearField(GoalsPage.updatedValueCss);
	await enterInput(GoalsPage.updatedValueCss, data);
};

export const saveDeadlineButtonVisible = async () => {
	await verifyElementIsVisible(GoalsPage.saveDeadlineButtonCss);
};

export const clickSaveDeadlineButton = async () => {
	await clickButton(GoalsPage.saveDeadlineButtonCss);
};

export const weightTypeButtonVisible = async () => {
	await verifyElementIsVisible(GoalsPage.weightTypeButtonCss);
};

export const clickWeightTypeButton = async (index) => {
	await clickButtonByIndex(GoalsPage.weightTypeButtonCss, index);
};

export const weightParameterDropdownVisible = async () => {
	await verifyElementIsVisible(GoalsPage.weightParameterDropdownCss);
};

export const clickWeightParameterDropdown = async () => {
	await clickButton(GoalsPage.weightParameterDropdownCss);
};

export const selectWeightParameterFromDropdown = async (text) => {
	await clickElementByText(GoalsPage.dropdownOptionCss, text);
};

export const progressBarVisible = async () => {
	await verifyElementIsVisible(GoalsPage.progressBarCss);
};

export const clickProgressBar = async (index) => {
	await clickButtonByIndex(GoalsPage.progressBarCss, index);
};

export const verifyElementIsDeleted = async (text) => {
	// POLLUTION RESILIENCE: assert the SPECIFIC goal we created is gone rather than that the whole grid
	// is empty — a prior spec (or an aborted earlier run) can leave other objectives on the shared seed,
	// which would make a blanket "no accordion headers" check fail even though our goal was deleted. When
	// no name is supplied, fall back to the original empty-grid assertion.
	if (text) {
		await verifyTextNotExisting(GoalsPage.verifyGoalCss, text);
	} else {
		await verifyElementNotExist(GoalsPage.verifyGoalCss);
	}
};

export const verifyGoalExists = async (text) => {
	await verifyText(GoalsPage.verifyGoalCss, text);
};
