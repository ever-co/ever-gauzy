import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbBadgeModule } from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { StatusBadgeComponent } from './status-badge.component';
import { ThemeModule } from '../../@theme/theme.module';

@NgModule({
	imports: [
		CommonModule,
		ThemeModule,
		NbBadgeModule,
		FormsModule,
		ReactiveFormsModule
	],
	exports: [StatusBadgeComponent],
	declarations: [StatusBadgeComponent]
})
export class StatusBadgeModule {}
