import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbToggleModule } from '@nebular/theme';
import { SmartTableToggleComponent } from './smart-table-toggle.component';

@NgModule({
	imports: [CommonModule, NbToggleModule],
	declarations: [SmartTableToggleComponent],
	exports: [SmartTableToggleComponent]
})
export class SmartTableToggleModule {}
