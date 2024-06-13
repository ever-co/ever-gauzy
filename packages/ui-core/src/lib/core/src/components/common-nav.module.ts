import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxPermissionsModule } from 'ngx-permissions';
import { NbAccordionModule, NbButtonModule, NbTooltipModule } from '@nebular/theme';
import { BaseNavMenuComponent } from './base-nav-menu/base-nav-menu.component';
import { MainNavMenuComponent } from './main-nav-menu/main-nav-menu.component';
import { MenuItemComponent, SidebarMenuComponent, ChildrenMenuItemComponent, TooltipDirective } from './sidebar-menu';

@NgModule({
	declarations: [
		BaseNavMenuComponent,
		MainNavMenuComponent,
		SidebarMenuComponent,
		MenuItemComponent,
		ChildrenMenuItemComponent,
		TooltipDirective
	],
	imports: [CommonModule, NbAccordionModule, NbTooltipModule, NbButtonModule, NgxPermissionsModule.forChild()],
	exports: [BaseNavMenuComponent, MainNavMenuComponent, SidebarMenuComponent]
})
export class CommonNavModule {}
