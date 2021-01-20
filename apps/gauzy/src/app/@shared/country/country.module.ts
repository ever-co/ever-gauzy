import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbSelectModule } from '@nebular/theme';
import { CountryService } from '../../@core/services/country.service';
import { ThemeModule } from '../../@theme/theme.module';
import { TranslaterModule } from '../translater/translater.module';
import { CountryComponent } from './country.component';

@NgModule({
	declarations: [CountryComponent],
	imports: [
		ThemeModule,
		FormsModule,
		ReactiveFormsModule,
		NbSelectModule,
		TranslaterModule
	],
	providers: [CountryService],
	exports: [CountryComponent]
})
export class CountryModule {}
