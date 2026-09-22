export const OrganizationEmploymentTypesPage = {
	gridButtonCss: 'div.layout-switch > button',
	addButtonCss: 'button[status="success"]:has-text("Add")',
	nameInputCss: '[placeholder="Employment type name"]',
	editNameInputCss: '[placeholder="Employment type name"]',
	addTagsDropdownCss: '#addTags',
	tagsDropdownOption: 'div.ng-option',
	saveButtonCss: 'button[status="success"]:has-text("Save")',
	editButtonCss: 'button.action.primary',
	deleteButtonCss: 'button.action:has(nb-icon[icon="trash-2-outline"])',
	confirmDeleteButtonCss: 'nb-card-footer > button[status="danger"]',
	cardBodyCss: 'nb-card-body',
	toastrMessageCss: 'nb-toast.ng-trigger',
	verifyTextCss: 'nb-tabset',
	// The list is now a card list (ga-notes-with-tags items); an item must be selected
	// to enable the header Edit/Delete actions.
	selectItemCss: 'nb-card-body.custom-table ga-notes-with-tags'
};
