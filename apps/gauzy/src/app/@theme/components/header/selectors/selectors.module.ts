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
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { DirectivesModule } from '@gauzy/ui-sdk/shared';
import { OrganizationSelectorComponent } from './organization/organization.component';
import { OrganizationEditStore, OrganizationsService } from '@gauzy/ui-sdk/core';

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
		I18nTranslateModule.forChild(),
		DirectivesModule
	],
	exports: [...COMPONENTS],
	declarations: [...COMPONENTS],
	providers: [OrganizationsService, OrganizationEditStore]
})
export class HeaderSelectorsModule {}
