import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './sidebar.component';

@NgModule({
	imports: [CommonModule],
	exports: [SidebarComponent],
	declarations: [SidebarComponent],
	providers: []
})
export class SidebarModule {}
