import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbCheckboxModule, NbFormFieldModule, NbIconModule, NbInputModule, NbSelectModule } from '@nebular/theme';
import { NgMapsGoogleModule } from '@ng-maps/google';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { LocationFormComponent } from './location-form.component';
import { CountryModule } from '../../modules/country/country.module';
import { LeafletMapModule } from '../maps/leaflet/leaflet.module';
import { CommonModule } from '@angular/common';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbSelectModule,
		NbInputModule,
		NbCheckboxModule,
		NbFormFieldModule,
		NbIconModule,
		NgMapsGoogleModule,
		I18nTranslateModule.forChild(),
		CountryModule,
		LeafletMapModule
	],
	exports: [LocationFormComponent],
	declarations: [LocationFormComponent]
})
export class LocationFormModule {}
