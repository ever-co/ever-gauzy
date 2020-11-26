import { NgModule } from '@angular/core';
import { LocationFormComponent } from './location-form.component';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { AgmCoreModule } from '@agm/core';
import { HttpLoaderFactory, ThemeModule } from '../../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbCheckboxModule,
	NbFormFieldModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule
} from '@nebular/theme';
import { HttpClient } from '@angular/common/http';
import { CountryModule } from '../../country/country.module';

@NgModule({
	imports: [
		ThemeModule,
		FormsModule,
		ReactiveFormsModule,
		NbSelectModule,
		NbInputModule,
		NbCheckboxModule,
		NbFormFieldModule,
		NbIconModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		AgmCoreModule,
		CountryModule
	],
	exports: [LocationFormComponent],
	declarations: [LocationFormComponent]
})
export class LocationFormModule {}
