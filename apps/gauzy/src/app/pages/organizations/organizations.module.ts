import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbListModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbTooltipModule,
	NbActionsModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { OrganizationEmploymentTypesService } from '@gauzy/ui-core/core';
import {
	CardGridModule,
	DirectivesModule,
	i4netButtonActionModule,
	ImageUploaderModule,
	OrganizationsMutationModule,
	PaginationV2Module,
	RecurringExpenseBlockModule,
	RecurringExpenseDeleteConfirmationModule,
	RecurringExpenseHistoryModule,
	RecurringExpenseMutationModule,
	RemoveLodashModule,
	TableComponentsModule,
	UserFormsModule
} from '@gauzy/ui-core/shared';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { OrganizationsRoutingModule } from './organizations-routing.module';
import { OrganizationsComponent } from './organizations.component';
import {
	OrganizationsCurrencyComponent,
	OrganizationTotalEmployeesCountComponent,
	OrganizationsFullnameComponent,
	OrganizationsStatusComponent
} from './table-components';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		TableComponentsModule,
		OrganizationsRoutingModule,
		NbCardModule,
		NbButtonModule,
		NbInputModule,
		Angular2SmartTableModule,
		NbIconModule,
		NbDialogModule.forChild(),
		OrganizationsMutationModule,
		UserFormsModule,
		ImageUploaderModule,
		NbSelectModule,
		RemoveLodashModule,
		NbListModule,
		NbTabsetModule,
		RecurringExpenseMutationModule,
		RecurringExpenseDeleteConfirmationModule,
		NbTooltipModule,
		I18nTranslateModule.forChild(),
		NbSpinnerModule,
		NbActionsModule,
		RecurringExpenseHistoryModule,
		RecurringExpenseBlockModule,
		NgxPermissionsModule.forChild(),
		i4netButtonActionModule,
		CardGridModule,
		PaginationV2Module,
		DirectivesModule
	],
	declarations: [
		OrganizationsComponent,
		OrganizationsFullnameComponent,
		OrganizationsStatusComponent,
		OrganizationTotalEmployeesCountComponent,
		OrganizationsCurrencyComponent
	],
	providers: [OrganizationEmploymentTypesService]
})
export class OrganizationsModule { }
