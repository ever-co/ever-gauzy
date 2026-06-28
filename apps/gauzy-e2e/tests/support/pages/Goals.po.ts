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

export const clickAddButton = async (index, name?) => {
	// The Goals page shows a full-card nb-spinner over the toolbar right after navigation; wait it out
	// first so the toolbar is interactive.
	await waitForSpinnerGone();
	// index 0 = toolbar "Add new Objective" (opens the nbPopover); index 1 = "Add new Key Result" inside
	// the expanded accordion body (a different element, not an nth() of the toolbar add button). When a
	// unique goal name is supplied, scope the key-result add button to OUR objective's body so we never
	// hit another (polluting) objective's button.
	const selector =
		index === 0
			? GoalsPage.addButtonCss
			: name
			? GoalsPage.addKeyResultButtonByName(name)
			: GoalsPage.addKeyResultButtonCss;
	const button = getPage().locator(selector).first();
	await button.waitFor({ state: 'attached', timeout: 24000 }).catch(() => {});
	if (index === 0) {
		// "Add new Objective" uses nbPopoverTrigger="click" with NO explicit (click) handler, so the
		// popover opens ONLY via Nebular's NbClickTriggerStrategy, which subscribes to
		// `fromEvent(document, 'click')` and SHOWS when `host.contains(event.target)`. A coordinate
		// {force:true} click was confirmed NOT to open it (3 real clicks, popover never rendered — no
		// cdk-overlay-pane ever appeared in the trace): the button sits inside the gauzy-button-action
		// `transition` div, which is offset by a CSS `transform: translateX()` and clipped by an
		// `overflow-x:hidden` parent. `force:true` only skips Playwright's actionability check — the
		// browser still hit-tests the screen coordinates, so the real `click` target ends up being the
		// clipping/transformed ancestor (NOT the button), making `host.contains(target)` false and the
		// popover never shows. Dispatching the event STRAIGHT to the button sets `event.target` to the
		// button itself, still bubbles to `document` (Playwright dispatchEvent => bubbles:true), so the
		// strategy's `isOnHost` matches and the popover opens — no coordinate hit-test involved. The
		// strategy TOGGLES on host clicks, so we check visibility first and only re-dispatch while it's
		// still closed (idempotent — never rapid re-click).
		const popoverList = getPage().locator(GoalsPage.optionDropdownCss).first();
		for (let attempt = 0; attempt < 3; attempt++) {
			if (await popoverList.isVisible().catch(() => false)) {
				return;
			}
			await button.dispatchEvent('click');
			await popoverList.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
		}
	} else {
		// "Add new Key Result" has a normal Angular (click)="addKeyResult(...)" host listener, which a
		// dispatched event triggers fine — dispatch past any fading post-mutation overlay.
		await button.dispatchEvent('click');
	}
};

export const selectOptionFromDropdown = async (index) => {
	// The "Add new Objective" nb-popover renders as a CDK overlay on click; wait for its option to
	// paint, then dispatch the click straight to the list item — a coordinate click can land on the
	// popover backdrop rather than the "Create new" item.
	await verifyElementIsVisible(GoalsPage.optionDropdownCss);
	await getPage().locator(GoalsPage.optionDropdownCss).nth(index).dispatchEvent('click');
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
