import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '../../translate/translate.module';
import { TimeZoneSelectorComponent } from './timezone-selector.component';

@NgModule({
	declarations: [TimeZoneSelectorComponent],
	exports: [TimeZoneSelectorComponent],
	imports: [CommonModule, FormsModule, ReactiveFormsModule, TranslateModule, NgSelectModule]
})
export class TimeZoneSelectorModule {}
