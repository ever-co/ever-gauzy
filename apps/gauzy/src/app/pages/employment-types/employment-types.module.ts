import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
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
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import {
	CardGridModule,
	i4netButtonActionModule,
	NoDataMessageModule,
	PaginationModule,
	SharedModule,
	TableComponentsModule,
	TagsColorInputModule
} from '@gauzy/ui-core/shared';
import { OrganizationEmploymentTypesService } from '@gauzy/ui-core/core';
import { EmploymentTypesRoutingModule } from './employment-types-routing.module';
import { EmploymentTypesComponent } from './employment-types.component';
import { WorkInProgressModule } from '../work-in-progress/work-in-progress.module';

@NgModule({
	imports: [
		SharedModule,
		CommonModule,
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
		I18nTranslateModule.forChild(),
		i4netButtonActionModule,
		PaginationModule,
		NbTabsetModule,
		NoDataMessageModule,
		NbTooltipModule,
		WorkInProgressModule
	],
	declarations: [EmploymentTypesComponent],
	providers: [OrganizationEmploymentTypesService]
})
export class EmploymentTypesModule { }
