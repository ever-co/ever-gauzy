import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule,
	NbActionsModule,
	NbTabsetModule,
	NbTooltipModule
} from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TagsColorInputModule } from '../../@shared/tags/tags-color-input/tags-color-input.module';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { SharedModule } from '../../@shared/shared.module';
import { OrganizationEmploymentTypesService } from '../../@core/services/organization-employment-types.service';
import { EmploymentTypesRoutingModule } from './employment-types-routing.module';
import { EmploymentTypesComponent } from './employment-types.component';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';
import { GauzyButtonActionModule } from '../../@shared/gauzy-button-action/gauzy-button-action.module';
import { PaginationModule } from '../../@shared/pagination/pagination.module';
import { NoDataMessageModule } from '../../@shared/no-data-message/no-data-message.module';
import { WorkInProgressModule } from '../work-in-progress/work-in-progress.module';

@NgModule({
	imports: [
		SharedModule,
		ThemeModule,
		NbCardModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		EmploymentTypesRoutingModule,
		NbInputModule,
		NbIconModule,
		TagsColorInputModule,
		TableComponentsModule,
		CardGridModule,
		NbDialogModule,
		Angular2SmartTableModule,
		NbActionsModule,
		NbDialogModule.forChild(),
		TranslateModule.forChild(),
		HeaderTitleModule,
		GauzyButtonActionModule,
		PaginationModule,
		NbTabsetModule,
		NoDataMessageModule,
		NbTooltipModule,
		WorkInProgressModule
	],
	declarations: [EmploymentTypesComponent],
	providers: [OrganizationEmploymentTypesService]
})
export class EmploymentTypesModule {}
