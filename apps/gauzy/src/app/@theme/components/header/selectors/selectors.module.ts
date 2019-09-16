import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DateSelectorComponent } from './date/date.component';
import { NgSelectModule } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';
import {
	NbCardModule,
	NbCalendarModule,
	NbCalendarKitModule,
	NbDatepickerModule,
	NbInputModule,
	NbButtonModule
} from '@nebular/theme';
import { OrganizationSelectorComponent } from './organization/organization.component';
import { OrganizationsService } from 'apps/gauzy/src/app/@core/services/organizations.service';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

const COMPONENTS = [OrganizationSelectorComponent, DateSelectorComponent];

@NgModule({
	imports: [
		CommonModule,
		NgSelectModule,
		FormsModule,
		NbCardModule,
		NbCalendarModule,
		NbCalendarKitModule,
		NbDatepickerModule,
		NbInputModule,
		NbButtonModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	exports: [...COMPONENTS],
	declarations: [...COMPONENTS],
	providers: [OrganizationsService]
})
export class HeaderSelectorsModule {}
