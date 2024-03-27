import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseNavMenuComponent } from './base-nav/base-nav.component';

@NgModule({
	imports: [CommonModule],
	declarations: [BaseNavMenuComponent],
	exports: [BaseNavMenuComponent],
})
export class CommonNavModule { }
