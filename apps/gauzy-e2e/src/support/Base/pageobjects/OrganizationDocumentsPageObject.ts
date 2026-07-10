export const OrganizationDocumentsPage = {
	gridButtonCss: 'div.layout-switch > button',
	// Toolbar Add button: <button nbButton status="success" size="small">…Add. The dialog template's
	// Save button is also status="success", so keep the :has-text("Add") qualifier to disambiguate.
	addButtonCss: 'button[status="success"]:has-text("Add")',
	nameInputCss: '#documentName',
	urlInputCss: 'ngx-file-uploader-input input.form-control',
	// A document row in the TABLE layout; clicking it calls selectDocument() which enables the
	// toolbar Edit/Delete buttons (they render [disabled]="true" until a row is selected).
	selectTableRowCss: 'nb-card-body.custom-table',
	saveButtonCss: 'button[status="success"]:has-text("Save")',
	editButtonCss: 'button.action.primary',
	deleteButtonCss: 'button.action:has(nb-icon[icon="trash-2-outline"])',
	confirmDeleteButtonCss: 'nb-card-footer > button[status="danger"]',
	cardBodyCss: 'nb-card-body',
	toastrMessageCss: 'nb-toast.ng-trigger',
	verifyDocumentCss: 'nb-card-body.custom-table a'
};
