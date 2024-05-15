import { NgModule } from '@angular/core';
import { LocationFormComponent } from './location-form.component';
import { NgMapsGoogleModule } from '@ng-maps/google';
import { ThemeModule } from '../../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbCheckboxModule, NbFormFieldModule, NbIconModule, NbInputModule, NbSelectModule } from '@nebular/theme';
import { CountryModule } from '../../country/country.module';
import { LeafletMapModule } from '../maps/leaflet/leaflet.module';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';

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
		TranslateModule,
		NgMapsGoogleModule,
		CountryModule,
		LeafletMapModule
	],
	exports: [LocationFormComponent],
	declarations: [LocationFormComponent]
})
export class LocationFormModule {}
