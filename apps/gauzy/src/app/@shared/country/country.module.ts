import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { CountryService } from '../../@core/services/country.service';
import { ThemeModule } from '../../@theme/theme.module';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { CountryComponent } from './country.component';

@NgModule({
	declarations: [CountryComponent],
	imports: [ThemeModule, FormsModule, ReactiveFormsModule, NgSelectModule, TranslateModule],
	providers: [CountryService],
	exports: [CountryComponent]
})
export class CountryModule {}
