// "+ Create" now opens the Quick Actions dialog (ngx-quick-actions), a grouped nb-menu of links.
// Selectors below target that dialog's markup (quick-actions.component.html + the nb-menu it renders).
export const CreateButton = {
	// Header "+ Create" button (header.component.html: button.button.create)
	createButtonCss: 'button.create',
	// The whole dialog host (used as a scope / presence check)
	quickActionsCss: 'ngx-quick-actions',
	// Dialog title: <nb-card-header><div><h6>Quick Actions</h6>...
	quickActionsTitleCss: 'ngx-quick-actions nb-card-header h6',
	// Group section headers: <p class="group-header">Accounting</p>
	groupHeaderCss: 'ngx-quick-actions p.group-header',
	// Each quick-action menu option title: nb-menu renders <span class="menu-title">Create Income</span>
	createButtonOptionCss: 'ngx-quick-actions nb-menu ul.menu-items li.menu-item a span.menu-title',
	// Dialog close control: <span class="cancel"><i class="fas fa-times"></i></span>
	closeButtonCss: 'ngx-quick-actions span.cancel'
};
