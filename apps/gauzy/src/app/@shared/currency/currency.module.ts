import { NgModule } from '@angular/core';
import { CurrencyComponent } from './currency.component';
import { CurrencyService } from '../../@core/services/currency.service';
import { ThemeModule } from '../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbSelectModule } from '@nebular/theme';
import { TranslaterModule } from '../translater/translater.module';

@NgModule({
	declarations: [CurrencyComponent],
	imports: [
		ThemeModule,
		FormsModule,
		ReactiveFormsModule,
		NbSelectModule,
		TranslaterModule
	],
	providers: [CurrencyService],
	exports: [CurrencyComponent]
})
export class CurrencyModule {}
