import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SmartTableToggleComponent } from './smart-table-toggle.component';
import { NbToggleModule } from '@nebular/theme';

@NgModule({
	declarations: [SmartTableToggleComponent],
	imports: [CommonModule, NbToggleModule],
	exports: [SmartTableToggleComponent]
})
export class SmartTableToggleModule {}
