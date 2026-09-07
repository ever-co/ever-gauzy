export const AddEmployeeLevelPage = {
	gridButtonCss: 'div.layout-switch > button',
	// Toolbar "+ Add" button (ng-template #visibleButton): nbButton status="success" with text "Add".
	// :has-text("Add") keeps it distinct from a stray status="success" Save button on a leaked dialog.
	addNewLevelButtonCss: 'button[status="success"]:has-text("Add")',
	// Level name input lives inside the add/edit nb-dialog; placeholder resolves to "Level name" (i18n LEVEL_NAME).
	newLevelInputCss: '[placeholder="Level name"]',
	// Tags is an ng-select (#addTags) with appendTo="body" — open via keyboard, options render as div.ng-option.
	tagsSelectCss: '#addTags',
	tagsSelectOptionCss: 'div.ng-option',
	// Save/Update button sits inside the dialog body (div.editable); scope to it so we don't hit the toolbar success button.
	saveNewLevelButtonCss: '.editable button[status="success"]',
	cancelNewLevelButtonCss: 'button.delete.mr-3',
	// Toolbar Edit button (ng-template #actionButtons): class="action primary".
	editEmployeeLevelButtonCss: 'button.action.primary',
	// Toolbar Delete button: class="action" carrying the trash icon (NOT the Edit "action primary" button).
	removeEmployeeLevelButtonCss: 'button.action:has(nb-icon[icon="trash-2-outline"])',
	confirmDeleteLevelButtonCss: 'nb-card-footer > button[status="danger"]',
	// Level name input of the EDIT dialog (#editableTemplate). Scoped to the dialog body and matched by
	// placeholder, exactly like the sibling Positions page — the old 'div.d-flex > input[type="text"]'
	// was bound to Bootstrap layout classes rather than to this control, so it matched any flex-row text
	// input anywhere on the page. That is unsafe now that the Edit click confirms on this selector:
	// dispatchClickWhenSettled checks the desired end state BEFORE dispatching, so a selector that
	// already matches something else would report the dialog as open and skip the click entirely,
	// turning an occasional lost click into a guaranteed one.
	editLevelInputCss: '.editable [placeholder="Level name"]',
	verifyTextCss: 'ga-notes-with-tags',
	cardBodyCss: 'nb-card-body',
	toastrMessageCss: 'nb-toast.ng-trigger',
	cancelButtonCss: 'button.delete.mr-3',
	// Selectable grid row: nb-card-body.custom-table carries the (click)="selectEmployee(...)" handler
	// that enables the toolbar Edit button. ga-notes-with-tags is its child (the level label/tags).
	selectEmployeeLevelRow: 'nb-card-body.custom-table',
	selectEmployeeLevelRowtoDelete: 'nb-card-body.custom-table',
	updateLevelButtonCss: '.editable button[status="success"]'
};
