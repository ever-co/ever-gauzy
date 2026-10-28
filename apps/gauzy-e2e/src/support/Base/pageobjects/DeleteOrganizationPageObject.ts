export const DeleteOrganizationPage = {
	gridButtonCss: 'div.layout-switch > button',
	// The organization delete confirmation (#10616, organization-delete-confirmation.component.html) is a
	// type-to-confirm dialog: `ga-organization-delete-confirmation nb-card.dialog` whose danger "Delete"
	// button stays [disabled]="!isConfirmed" until the organization's name is typed into #org-delete-name.
	// It replaced the shared DeleteConfirmationComponent (`nb-card.center` + an always-enabled OK button).
	confirmDialogCss: 'ga-organization-delete-confirmation',
	confirmNameInputCss: 'ga-organization-delete-confirmation input#org-delete-name',
	confirmDeleteCss: 'ga-organization-delete-confirmation nb-card-footer button[status="danger"]',
	// Toolbar Delete (trash icon). It is [disabled] until a grid row is selected
	// (`[disabled]="!selectedItem && disableButton"` in organizations.component.html), so the row
	// must be selected first or the (click)->deleteOrganization() handler never fires.
	// Scoped to the toolbar so the confirmation dialog's own trash-icon button can never match.
	deleteButtonCss: 'ngx-gauzy-button-action button:has(nb-icon[icon="trash-2-outline"])',
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
