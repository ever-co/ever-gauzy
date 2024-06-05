import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../@theme/theme.module';
import { CurrencyService } from '@gauzy/ui-sdk/core';
import { CurrencyComponent } from './currency.component';

@NgModule({
	declarations: [CurrencyComponent],
	imports: [ThemeModule, FormsModule, ReactiveFormsModule, NgSelectModule, I18nTranslateModule.forChild()],
	providers: [CurrencyService],
	exports: [CurrencyComponent]
})
export class CurrencyModule {}
