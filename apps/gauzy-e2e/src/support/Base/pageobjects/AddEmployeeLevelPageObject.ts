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
	editLevelInputCss: 'div.d-flex > input[type="text"]',
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
