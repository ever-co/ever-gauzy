import { NgModule } from '@angular/core';
import { CurrencyComponent } from './currency.component';
import { CurrencyService } from '../../@core/services/currency.service';
import { HttpLoaderFactory, ThemeModule } from '../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbSelectModule } from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';

@NgModule({
	declarations: [CurrencyComponent],
	imports: [
		ThemeModule,
		FormsModule,
		ReactiveFormsModule,
		NbSelectModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	providers: [CurrencyService],
	exports: [CurrencyComponent]
})
export class CurrencyModule {}
