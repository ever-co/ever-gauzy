import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxPermissionsModule } from 'ngx-permissions';
import { NbAccordionModule, NbButtonModule, NbTooltipModule } from '@nebular/theme';
import { BaseNavMenuComponent } from './base-nav-menu/base-nav-menu.component';
import { MainNavMenuComponent } from './main-nav-menu/main-nav-menu.component';
import { SettingsNavMenuComponent } from './settings-nav-menu/settings-nav-menu.component';
import { MenuItemComponent, SidebarMenuComponent, ChildrenMenuItemComponent } from './sidebar-menu';
import { TooltipDirective } from '../directives/tooltip.directive';

// Components that are standalone
const STANDALONE_COMPONENTS = [
	BaseNavMenuComponent,
	MainNavMenuComponent,
	SidebarMenuComponent,
	MenuItemComponent,
	ChildrenMenuItemComponent,
	SettingsNavMenuComponent
];

@NgModule({
	imports: [
		CommonModule,
		NbAccordionModule,
		NbTooltipModule,
		NbButtonModule,
		NgxPermissionsModule.forChild(),
		TooltipDirective,
		...STANDALONE_COMPONENTS
	],
	declarations: [],
	exports: [...STANDALONE_COMPONENTS]
})
export class CommonNavModule {}
