import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarMenuComponent } from './sidebar-menu.component';
import { SharedModule } from '../shared.module';

@NgModule({
	declarations: [SidebarMenuComponent],
	imports: [CommonModule, SharedModule],
	exports: [SidebarMenuComponent]
})
export class SidebarMenuModule {}
