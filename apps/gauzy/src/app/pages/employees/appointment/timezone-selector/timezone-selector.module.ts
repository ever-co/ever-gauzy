import { NgModule } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NbCardModule, NbButtonModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { ThemeModule } from '../../../../@theme/theme.module';
import { TimezoneSelectorComponent } from './timezone-selector.component';

@NgModule({
	imports: [
		ThemeModule,
		NbCardModule,
		ReactiveFormsModule,
		FormsModule,
		NbButtonModule,
		NgSelectModule,
		I18nTranslateModule.forChild()
	],
	exports: [TimezoneSelectorComponent],
	declarations: [TimezoneSelectorComponent],
	providers: []
})
export class TimezoneSelectorModule {}
