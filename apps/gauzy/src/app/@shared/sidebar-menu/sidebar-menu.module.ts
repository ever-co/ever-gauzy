import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarMenuComponent } from './sidebar-menu.component';
import { SharedModule } from '../shared.module';
import { NbAccordionModule } from '@nebular/theme';

@NgModule({
	declarations: [SidebarMenuComponent],
	imports: [CommonModule, SharedModule, NbAccordionModule],
	exports: [SidebarMenuComponent]
})
export class SidebarMenuModule {}
