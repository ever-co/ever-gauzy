import { NgModule } from '@angular/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { BaseNavMenuComponent } from './base-nav-menu/base-nav-menu.component';
import { MainNavMenuComponent } from './main-nav-menu/main-nav-menu.component';
import { SettingsNavMenuComponent } from './settings-nav-menu/settings-nav-menu.component';
import { SidebarMenuComponent, TooltipDirective } from './sidebar-menu';

@NgModule({
	imports: [
		NgxPermissionsModule.forChild(),
		BaseNavMenuComponent,
		MainNavMenuComponent,
		SettingsNavMenuComponent,
		SidebarMenuComponent,
		TooltipDirective
	],
	exports: [
		MainNavMenuComponent,
		SidebarMenuComponent,
		SettingsNavMenuComponent,
		BaseNavMenuComponent,
		TooltipDirective
	]
})
export class CommonNavModule {}
