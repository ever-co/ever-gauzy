import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbSelectModule } from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { CountryService } from '../../@core/services/country.service';
import { HttpLoaderFactory, ThemeModule } from '../../@theme/theme.module';
import { CountryComponent } from './country.component';

@NgModule({
	declarations: [CountryComponent],
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
	providers: [CountryService],
	exports: [CountryComponent]
})
export class CountryModule {}
