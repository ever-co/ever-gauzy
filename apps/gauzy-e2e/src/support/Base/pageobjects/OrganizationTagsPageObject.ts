export const OrganizationTagsPage = {
	addTagButtonCss: 'button[status="success"]:has-text("Add")',
	closeDialogButtonCss: 'nb-card-header span.cancel i.fa-times',
	tagNameInputCss: '#inputName',
	tagColorInputCss: '#inputColor',
	tagTenantCheckboxCss: 'span.custom-checkbox',
	tagDescriptionCss: '#inputDescription',
	cancelButtonCss: 'nb-card-footer.text-left > button[status="basic"]',
	saveButtonCss: '.text-left [status="success"]',
	gridButtonCss: 'div.layout-switch > button',
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	editTagButtonCss: 'button.action.primary',
	deleteTagButtonCss: 'button.action:has(nb-icon[icon="trash-2-outline"])',
	confirmDeleteTagButtonCss: 'nb-card-footer > button[status="danger"]',
	cancelDeleteTagButtonCss: 'nb-card-footer > button[status="basic"]',
	toastrMessageCss: 'nb-toast.ng-trigger',
	verifyTagCss: 'angular2-smart-table tbody',
	// The Name column's filter input, addressed by COLUMN KEY (angular2-smart-table puts the key on the
	// header cell) rather than by placeholder — the placeholder is the translated column title, so it
	// stops matching as soon as a spec switches the UI language. The tags grid paginates at 10 and the
	// suite accumulates tags, so every row assertion has to filter through this first.
	filterNameInputCss: 'th.angular2-smart-th.name input',
	firstTableCellTagCss: 'tbody > tr.angular2-smart-row:first-of-type > td:first-of-type'
};
