import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbBadgeModule } from '@nebular/theme';
import { StatusBadgeComponent } from './status-badge.component';

@NgModule({
	imports: [CommonModule, FormsModule, ReactiveFormsModule, NbBadgeModule],
	exports: [StatusBadgeComponent],
	declarations: [StatusBadgeComponent]
})
export class StatusBadgeModule {}
