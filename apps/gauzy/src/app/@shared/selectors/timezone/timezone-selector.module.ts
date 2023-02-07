import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '../../translate/translate.module';
import { TimeZoneContactSelectorComponent } from './timezone-selector.component';

@NgModule({
	declarations: [TimeZoneContactSelectorComponent],
	exports: [TimeZoneContactSelectorComponent],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		TranslateModule,
		NgSelectModule
	]
})
export class TimeZoneSelectorModule {}
