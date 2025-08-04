const ACTIONS_CONTAINER_CSS = '.actions-container';

export const OrganizationTeamsPage = {
	gridButtonCss: 'div.layout-switch > button',
	addTeamButtonCss: 'nb-card-body > div > button[status="success"]',
	teamNameInputCss: '[placeholder="Team Name"]',
	tagsSelectCss: 'nb-dialog-container #addTags .ng-input input',
	tagsSelectOptionCss: 'div.ng-option',
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	cardBodyCss: 'nb-card-body',
	employeeMultiSelectCss: '[ng-reflect-placeholder="Add or Remove Team Members"]',
	managerMultiSelectCss: '[ng-reflect-placeholder="Add or Remove Team Managers"]',
	selectDropdownOptionCss: '.option-list nb-option',
	saveButtonCss: 'nb-card-footer > button[status="success"]',
	editButtonCss: 'nb-card-body > div > button[status="info"]',
	deleteButtonCss: `${ACTIONS_CONTAINER_CSS} .actions.ng-star-inserted button:last-of-type`,
	confirmDeleteButtonCss: 'nb-card-footer > button[status="danger"]',
	toastrMessageCss: 'nb-toast.ng-trigger',
	verifyTeamCss: 'div.ng-star-inserted',
	addModalCss: 'nb-dialog-container',
	// testing library
	actionsBarCss: ACTIONS_CONTAINER_CSS,
	addButtonName: 'Add',
	saveButtonName: 'Save'
};
