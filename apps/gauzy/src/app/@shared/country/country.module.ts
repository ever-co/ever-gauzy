import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { CountryService } from '../../@core/services/country.service';
import { ThemeModule } from '../../@theme/theme.module';
import { CountryComponent } from './country.component';

@NgModule({
	declarations: [CountryComponent],
	imports: [ThemeModule, FormsModule, ReactiveFormsModule, NgSelectModule, TranslateModule.forChild()],
	providers: [CountryService],
	exports: [CountryComponent]
})
export class CountryModule {}
