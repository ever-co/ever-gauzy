import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbBadgeModule } from '@nebular/theme';
import { LabelComponent } from './label.component';

@NgModule({
	imports: [CommonModule, NbBadgeModule],
	declarations: [LabelComponent],
	exports: [LabelComponent]
})
export class LabelModule {}
