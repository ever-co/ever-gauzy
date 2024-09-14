import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbInputModule, NbTooltipModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { TextAreaComponent } from './text-area.component';

@NgModule({
	declarations: [TextAreaComponent],
	exports: [TextAreaComponent],
	imports: [
		CommonModule,
		NbInputModule,
		TranslateModule,
		NgSelectModule,
		NbTooltipModule,
		FormsModule,
		ReactiveFormsModule
	]
})
export class TextAreaModule {}
