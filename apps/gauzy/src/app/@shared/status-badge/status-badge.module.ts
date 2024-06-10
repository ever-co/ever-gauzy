import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbBadgeModule } from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { StatusBadgeComponent } from './status-badge.component';

@NgModule({
	imports: [CommonModule, NbBadgeModule, FormsModule, ReactiveFormsModule],
	exports: [StatusBadgeComponent],
	declarations: [StatusBadgeComponent]
})
export class StatusBadgeModule {}
