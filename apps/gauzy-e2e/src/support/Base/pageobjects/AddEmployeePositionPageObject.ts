export const AddEmployeePositionPage = {
	gridButtonCss: 'div.layout-switch > button',
	// Toolbar "Add" button (ng-template #visibleButton): nbButton status="success" with text "Add".
	// :has-text("Add") keeps it distinct from a stray status="success" Save button on a leaked dialog
	// (the addTag setup command can leave an "Add Tags" dialog mounted in a body-level cdk overlay).
	addNewPositionButtonCss: 'button[status="success"]:has-text("Add")',
	// Position name input lives inside the add/edit nb-dialog; placeholder resolves to "Position name"
	// (i18n ORGANIZATIONS_PAGE.EDIT.POSITION_NAME).
	newPositionInputCss: '[placeholder="Position name"]',
	// Tags is an ng-select (#addTags) with appendTo="body" — open via keyboard, options are div.ng-option.
	tagsSelectCss: '#addTags',
	tagsSelectOptionCss: 'div.ng-option',
	// Save/Update button sits inside the dialog body (div.editable); scope to it so we don't hit the
	// toolbar success button.
	saveNewPositionButtonCss: '.editable button[status="success"]',
	updatePositionButtonCss: '.editable button[status="success"]',
	// Dialog Cancel button: class="delete mr-3 ml-3", status="basic" (NOT danger).
	cancelNewPositionButtonCss: 'button.delete.mr-3',
	// Toolbar Edit button (ng-template #actionButtons): class="action primary".
	editEmployeePositionButtonCss: 'button.action.primary',
	// Toolbar Delete button: class="action" carrying the trash icon (NOT the Edit "action primary" one).
	removeEmployeePositionButtonCss: 'button.action:has(nb-icon[icon="trash-2-outline"])',
	confirmDeletePositionButtonCss: 'nb-card-footer > button[status="danger"]',
	editPositionInputCss: 'div.d-flex > input[type="text"]',
	verifyTextCss: 'ga-notes-with-tags',
	cardBodyCss: 'nb-card-body',
	toastrMessageCss: 'nb-toast.ng-trigger',
	cancelButtonCss: 'button.delete.mr-3',
	// Selectable grid row: nb-card-body.custom-table carries the (click)="selectPosition(...)" handler
	// that enables the toolbar Edit/Delete buttons. ga-notes-with-tags is its child (name + tags).
	selectPositionToEditCss: 'nb-card-body.custom-table',
	selectPositionToDeleteCss: 'nb-card-body.custom-table'
};
