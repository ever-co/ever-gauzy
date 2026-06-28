export const GoalsPage = {
	addButtonCss: '.gauzy-button-container button[status="success"]',
	// "Add new Objective" opens an nb-popover (#createObjectivePopover) whose nb-list holds the
	// "Create new" / "Create from preset" items. Scope to nb-popover so .nth(0) hits that list and
	// NOT the Quick-Settings sidebar list, which also matches `nb-list[role="list"] nb-list-item`
	// and (being off-screen) caused an "Element is outside of the viewport" click failure.
	optionDropdownCss: 'nb-popover nb-list[role="list"] nb-list-item',
	// "Add new Key Result" lives in the EXPANDED accordion item's body (status="success", class "gen"),
	// NOT in the toolbar's .gauzy-button-container — so the spec's clickAddButton(1) needs this selector,
	// not an nth(1) of the toolbar add button (which only ever has one success button).
	addKeyResultButtonCss: '.goals-container nb-accordion-item-body button[status="success"]',
	nameInputCss: '[formcontrolname="name"]',
	ownerDropdownCss: '[formcontrolname="ownerId"]',
	dropdownOptionCss: '.option-list nb-option',
	leadDropdownCss: '#objective-lead',
	// The objective form's "deadline" (time frame) is a REQUIRED nb-select (deadline:
	// ['', Validators.required]); without picking one the Save button stays disabled and no goal is
	// created. The seed always provides active future time frames (Annual-<year> + quarters), so the
	// select renders options under `.option-list nb-option`.
	deadlineDropdownCss: '#objective-deadline',
	// The selectable key-result ROW inside the expanded accordion body — clicking it fires
	// onClickKeyResult, which selects the key result so the toolbar swaps to the key-result actions
	// (View / Edit / Weight%). The "Add new Key Result" body button is a sibling without this class.
	keyResultRowCss: '.goals-container nb-accordion-item-body div.keyResult',
	timeframeOptionCss: 'div.col-md-4 > nb-list[role="list"] nb-list-item',
	confirmButtonCss: 'nb-card-footer > button[status="success"]',
	editButtonCss: '.gauzy-button-container button.action.primary',
	viewButtonCss: '.gauzy-button-container button.action.secondary',
	// The objective actions template's Delete button is the only toolbar button bound to
	// [disabled]="!selectedGoal.isSelected" — its real `disabled` attr is a reliable "objective is
	// selected" signal that survives the toolbar's translateX hide trick (which fools Playwright's
	// isVisible). The key-result template's delete has no such binding.
	objectiveDeleteButtonCss: '.gauzy-button-container .btn-group.actions button.action:has(nb-icon[status="danger"])',
	deleteButtonCss: 'nb-card-header .button-container button:has(nb-icon[status="danger"])',
	toastrMessageCss: 'nb-toast.ng-trigger',
	keyResultInputCss: '#key-result-title',
	initialValueCss: '#initial-value',
	targetValueCss: '#target-value',
	toggleButtonCss: 'div.toggle',
	keyResultOwnerCss: '#key-result-owner',
	keyResultLeadCss: '#key-result-lead',
	tableRowCss: '.goals-container nb-accordion nb-accordion-item',
	addDeadlineButtonCss: '.main-header .button-container button[status="success"]',
	updatedValueCss: '#updated-value',
	weightTypeButtonCss: '.gauzy-button-container button.action:has(i.fa-percentage)',
	weightParameterDropdownCss: '#key-result-weight',
	saveDeadlineButtonCss: 'div.d-flex > button[status="success"]',
	progressBarCss: '.goals-container nb-progress-bar',
	verifyGoalCss: '.goals-container nb-accordion-item-header'
};
