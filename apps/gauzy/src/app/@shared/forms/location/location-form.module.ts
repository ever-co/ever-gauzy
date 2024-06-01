import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbCheckboxModule, NbFormFieldModule, NbIconModule, NbInputModule, NbSelectModule } from '@nebular/theme';
import { NgMapsGoogleModule } from '@ng-maps/google';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { LocationFormComponent } from './location-form.component';
import { ThemeModule } from '../../../@theme/theme.module';
import { CountryModule } from '../../country/country.module';
import { LeafletMapModule } from '../maps/leaflet/leaflet.module';

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
		TranslateModule.forChild(),
		NgMapsGoogleModule,
		CountryModule,
		LeafletMapModule
	],
	exports: [LocationFormComponent],
	declarations: [LocationFormComponent]
})
export class LocationFormModule {}
