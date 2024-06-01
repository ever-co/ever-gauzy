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
import { OrganizationEditStore } from 'apps/gauzy/src/app/@core/services/organization-edit-store.service';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { OrganizationsService } from '@gauzy/ui-sdk/core';
import { DirectivesModule } from '../../../../@shared/directives/directives.module';

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
		TranslateModule.forChild(),
		DirectivesModule
	],
	exports: [...COMPONENTS],
	declarations: [...COMPONENTS],
	providers: [OrganizationsService, OrganizationEditStore]
})
export class HeaderSelectorsModule {}
