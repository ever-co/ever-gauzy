import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbDialogModule,
	NbToastrModule
} from '@nebular/theme';
import { ThemeModule } from '../../../@theme/theme.module';
import { EventTypeRoutingModule } from './event-type.routing.module';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { EventTypeService } from '@gauzy/ui-sdk/core';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { GauzyButtonActionModule, PaginationV2Module } from '@gauzy/ui-sdk/shared';
import { EventTypeComponent } from './event-type.component';
import { EmployeeSelectorsModule } from '../../../@theme/components/header/selectors/employee/employee.module';
import { EventTypeMutationModule } from './event-type-mutation/event-type-mutation.module';
import { UserFormsModule } from '../../../@shared/user/forms/user-forms.module';
import { TagsColorInputModule } from '../../../@shared/tags/tags-color-input/tags-color-input.module';
import { TableComponentsModule } from '../../../@shared/table-components/table-components.module';
import { CardGridModule } from '../../../@shared/card-grid/card-grid.module';
import { BackNavigationModule } from '../../../@shared/back-navigation/back-navigation.module';
import { HeaderTitleModule } from '../../../@shared/components/header-title/header-title.module';

@NgModule({
	imports: [
		TableComponentsModule,
		TagsColorInputModule,
		EventTypeRoutingModule,
		ThemeModule,
		NbToastrModule,
		EmployeeSelectorsModule,
		NbCardModule,
		FormsModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		NbSelectModule,
		Angular2SmartTableModule,
		NbSpinnerModule,
		EventTypeMutationModule,
		UserFormsModule,
		CardGridModule,
		BackNavigationModule,
		NbDialogModule.forChild(),
		I18nTranslateModule.forChild(),
		HeaderTitleModule,
		GauzyButtonActionModule,
		PaginationV2Module
	],
	declarations: [EventTypeComponent],
	providers: [EventTypeService]
})
export class EventTypeModule {}
