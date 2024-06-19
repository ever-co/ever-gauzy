import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { TimeZoneSelectorComponent } from './timezone-selector.component';

@NgModule({
	declarations: [TimeZoneSelectorComponent],
	exports: [TimeZoneSelectorComponent],
	imports: [CommonModule, FormsModule, ReactiveFormsModule, I18nTranslateModule.forChild(), NgSelectModule]
})
export class TimeZoneSelectorModule {}
