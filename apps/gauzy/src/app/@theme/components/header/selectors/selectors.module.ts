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
import { OrganizationEditStore } from 'apps/gauzy/src/app/@core/services/organization-edit-store.service';
import { TranslateModule } from 'apps/gauzy/src/app/@shared/translate/translate.module';

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
		TranslateModule
	],
	exports: [...COMPONENTS],
	declarations: [...COMPONENTS],
	providers: [OrganizationsService, OrganizationEditStore]
})
export class HeaderSelectorsModule {}
