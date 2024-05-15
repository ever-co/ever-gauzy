import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { CurrencyService } from '../../@core/services';
import { CurrencyComponent } from './currency.component';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';

@NgModule({
	declarations: [CurrencyComponent],
	imports: [ThemeModule, FormsModule, ReactiveFormsModule, NgSelectModule, TranslateModule],
	providers: [CurrencyService],
	exports: [CurrencyComponent]
})
export class CurrencyModule {}
