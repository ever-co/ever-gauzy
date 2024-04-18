import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseNavMenuComponent } from './base-nav-menu/base-nav-menu.component';
import { MainNavMenuComponent } from './main-nav-menu/main-nav-menu.component';
import { SidebarMenuModule } from '../../@shared/sidebar-menu/sidebar-menu.module';

@NgModule({
	imports: [CommonModule, SidebarMenuModule],
	declarations: [BaseNavMenuComponent, MainNavMenuComponent],
	exports: [BaseNavMenuComponent, MainNavMenuComponent],
})
export class CommonNavModule { }
