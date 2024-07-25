import { NgModule } from '@angular/core';
import { NbAccordionModule, NbButtonModule, NbTooltipModule } from '@nebular/theme';
import { SharedModule } from '@gauzy/ui-core/shared';
import { BaseNavMenuComponent } from './base-nav-menu/base-nav-menu.component';
import { MainNavMenuComponent } from './main-nav-menu/main-nav-menu.component';
import { MenuItemComponent, SidebarMenuComponent, ChildrenMenuItemComponent, TooltipDirective } from './sidebar-menu';

@NgModule({
	imports: [NbAccordionModule, NbTooltipModule, NbButtonModule, SharedModule],
	exports: [BaseNavMenuComponent, MainNavMenuComponent, SidebarMenuComponent],
	declarations: [
		BaseNavMenuComponent,
		MainNavMenuComponent,
		SidebarMenuComponent,
		MenuItemComponent,
		ChildrenMenuItemComponent,
		TooltipDirective
	]
})
export class CommonNavModule {}
