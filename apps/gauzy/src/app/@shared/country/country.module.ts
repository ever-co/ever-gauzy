import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbSelectModule } from '@nebular/theme';
import { CountryService } from '../../@core/services/country.service';
import { ThemeModule } from '../../@theme/theme.module';
import { TranslateModule } from '../translate/translate.module';
import { CountryComponent } from './country.component';

@NgModule({
	declarations: [CountryComponent],
	imports: [
		ThemeModule,
		FormsModule,
		ReactiveFormsModule,
		NbSelectModule,
		TranslateModule
	],
	providers: [CountryService],
	exports: [CountryComponent]
})
export class CountryModule {}
