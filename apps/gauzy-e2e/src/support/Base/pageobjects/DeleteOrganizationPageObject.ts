export const DeleteOrganizationPage = {
	gridButtonCss: 'div.layout-switch > button',
	confirmDeleteCss: 'nb-card.center > nb-card-footer > button[status="danger"]',
	// Toolbar Delete (trash icon). It is [disabled] until a grid row is selected
	// (`[disabled]="!selectedItem && disableButton"` in organizations.component.html), so the row
	// must be selected first or the (click)->deleteOrganization() handler never fires.
	deleteButtonCss: 'button:has(nb-icon[icon="trash-2-outline"])',
	// Data row in the smart-table (NOT the tr.angular2-smart-filters filter row); selecting it enables
	// the toolbar Edit/Manage/Delete buttons.
	selectOrganization: 'table > tbody > tr.angular2-smart-row'
};
