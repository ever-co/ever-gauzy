import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbTooltipModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { SelectComponent } from './select.component';

@NgModule({
	declarations: [SelectComponent],
	exports: [SelectComponent],
	imports: [CommonModule, TranslateModule, NgSelectModule, NbTooltipModule, FormsModule, ReactiveFormsModule]
})
export class SelectModule {}
