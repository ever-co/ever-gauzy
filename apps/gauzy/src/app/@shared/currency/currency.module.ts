import { NgModule } from '@angular/core';
import { CurrencyComponent } from './currency.component';
import { CurrencyService } from '../../@core/services/currency.service';
import { ThemeModule } from '../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '../translate/translate.module';

@NgModule({
	declarations: [CurrencyComponent],
	imports: [
		ThemeModule,
		FormsModule,
		ReactiveFormsModule,
		NbSelectModule,
		TranslateModule
	],
	providers: [CurrencyService],
	exports: [CurrencyComponent]
})
export class CurrencyModule {}
