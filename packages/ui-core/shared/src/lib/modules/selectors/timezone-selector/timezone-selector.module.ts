import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { TimeZoneSelectorComponent } from './timezone-selector.component';

@NgModule({
	declarations: [TimeZoneSelectorComponent],
	exports: [TimeZoneSelectorComponent],
	imports: [CommonModule, FormsModule, ReactiveFormsModule, I18nTranslateModule.forChild(), NgSelectModule]
})
export class TimeZoneSelectorModule {}
