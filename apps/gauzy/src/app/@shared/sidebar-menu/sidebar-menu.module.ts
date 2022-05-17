import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarMenuComponent } from './sidebar-menu.component';
import { SharedModule } from '../shared.module';
import { NbAccordionModule, NbTooltipModule } from '@nebular/theme';
import { MenuItemComponent } from './menu-items/concrete/menu-item/menu-item.component';
import { ChildrenMenuItemComponent } from './menu-items/concrete/children-menu-item/children-menu-item.component';

@NgModule({
	declarations: [
		SidebarMenuComponent,
		MenuItemComponent,
		ChildrenMenuItemComponent
	],
	imports: [CommonModule, SharedModule, NbAccordionModule, NbTooltipModule],
	exports: [SidebarMenuComponent]
})
export class SidebarMenuModule {}
