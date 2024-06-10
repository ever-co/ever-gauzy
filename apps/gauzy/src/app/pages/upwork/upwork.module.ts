import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbToggleModule,
	NbDatepickerModule,
	NbCalendarKitModule,
	NbTooltipModule,
	NbIconModule,
	NbTabsetModule,
	NbRouteTabsetModule,
	NbCheckboxModule,
	NbActionsModule,
	NbContextMenuModule
} from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { TableComponentsModule } from '@gauzy/ui-sdk/shared';
import { UpworkComponent } from './components/upwork/upwork.component';
import { UpworkRoutingModule } from './upwork-routing.module';
import { UpworkAuthorizeComponent } from './components/upwork-authorize/upwork-authorize.component';
import { TransactionsComponent } from './components/transactions/transactions.component';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { ContractsComponent } from './components/contracts/contracts.component';
import { SyncDataSelectionComponent } from './components/sync-data-selection/sync-data-selection.component';
import { EmployeeSelectorsModule } from '../../@theme/components/header/selectors/employee/employee.module';
import { ReportsComponent } from './components/reports/reports.component';
import { SharedModule } from '../../@shared/shared.module';

@NgModule({
	declarations: [
		UpworkComponent,
		UpworkAuthorizeComponent,
		TransactionsComponent,
		ContractsComponent,
		SyncDataSelectionComponent,
		ReportsComponent
	],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbCardModule,
		NbButtonModule,
		NbInputModule,
		NbToggleModule,
		NbDatepickerModule,
		NbCalendarKitModule,
		NbTooltipModule,
		NbIconModule,
		NbTabsetModule,
		NbRouteTabsetModule,
		NbCheckboxModule,
		NbActionsModule,
		NbContextMenuModule,
		UpworkRoutingModule,
		Angular2SmartTableModule,
		I18nTranslateModule.forChild(),
		SharedModule,
		TableComponentsModule,
		EmployeeSelectorsModule
	]
})
export class UpworkModule {}
