import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxPermissionsModule } from 'ngx-permissions';
import { NbAccordionModule, NbButtonModule, NbTooltipModule } from '@nebular/theme';
import { BaseNavMenuComponent } from './base-nav-menu/base-nav-menu.component';
import { MainNavMenuComponent } from './main-nav-menu/main-nav-menu.component';
import { SettingsNavMenuComponent } from './settings-nav-menu/settings-nav-menu.component';
import { MenuItemComponent, SidebarMenuComponent, ChildrenMenuItemComponent, TooltipDirective } from './sidebar-menu';

const COMPONENTS = [BaseNavMenuComponent, MainNavMenuComponent, SidebarMenuComponent, SettingsNavMenuComponent];

@NgModule({
	imports: [CommonModule, NbAccordionModule, NbTooltipModule, NbButtonModule, NgxPermissionsModule.forChild()],
	declarations: [...COMPONENTS, MenuItemComponent, ChildrenMenuItemComponent, TooltipDirective],
	exports: [...COMPONENTS]
})
export class CommonNavModule {}
