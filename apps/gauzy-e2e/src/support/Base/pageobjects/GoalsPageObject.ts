export const GoalsPage = {
	addButtonCss: '.gauzy-button-container button[status="success"]',
	// "Add new Objective" opens an nb-popover (#createObjectivePopover) whose nb-list holds the
	// "Create new" / "Create from preset" items. Scope to nb-popover so .nth(0) hits that list and
	// NOT the Quick-Settings sidebar list, which also matches `nb-list[role="list"] nb-list-item`
	// and (being off-screen) caused an "Element is outside of the viewport" click failure.
	optionDropdownCss: 'nb-popover nb-list[role="list"] nb-list-item',
	nameInputCss: '[formcontrolname="name"]',
	ownerDropdownCss: '[formcontrolname="ownerId"]',
	dropdownOptionCss: '.option-list nb-option',
	leadDropdownCss: '#objective-lead',
	timeframeOptionCss: 'div.col-md-4 > nb-list[role="list"] nb-list-item',
	confirmButtonCss: 'nb-card-footer > button[status="success"]',
	editButtonCss: '.gauzy-button-container button.action.primary',
	viewButtonCss: '.gauzy-button-container button.action.secondary',
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
