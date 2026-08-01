export const DeleteOrganizationPage = {
	gridButtonCss: 'div.layout-switch > button',
	confirmDeleteCss: 'nb-card.center > nb-card-footer > button[status="danger"]',
	// Toolbar Delete (trash icon). It is [disabled] until a grid row is selected
	// (`[disabled]="!selectedItem && disableButton"` in organizations.component.html), so the row
	// must be selected first or the (click)->deleteOrganization() handler never fires.
	deleteButtonCss: 'button:has(nb-icon[icon="trash-2-outline"])',
	// Data row in the smart-table (NOT the tr.angular2-smart-filters filter row); selecting it enables
	// the toolbar Edit/Manage/Delete buttons.
	selectOrganization: 'table > tbody > tr.angular2-smart-row',
	// Name-column filter input in the smart-table header (tr.angular2-smart-filters). The organizations
	// grid pages at 10 rows (minItemPerPage) and gains a row per add-organization / manage-organization /
	// organization-public-page run on the shared serial DB, so the throwaway organization this spec
	// creates is usually NOT on page 1. Typing its name narrows the grid to that single record.
	// Column key is `name` (organizations.component.ts _loadSmartTableSettings).
	nameFilterInputCss: 'th.angular2-smart-th.name input'
};
