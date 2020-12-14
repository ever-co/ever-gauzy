import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UpworkComponent } from './components/upwork/upwork.component';
import { UpworkRoutingModule } from './upwork-routing.module';
import {
	NbCardModule,
	NbInputModule,
	NbButtonModule,
	NbIconModule,
	NbTooltipModule,
	NbTabsetModule,
	NbRouteTabsetModule,
	NbToggleModule,
	NbDatepickerModule,
	NbCalendarKitModule,
	NbCheckboxModule,
	NbActionsModule,
	NbContextMenuModule
} from '@nebular/theme';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { UpworkAuthorizeComponent } from './components/upwork-authorize/upwork-authorize.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TransactionsComponent } from './components/transactions/transactions.component';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { ContractsComponent } from './components/contracts/contracts.component';
import { SyncDataSelectionComponent } from './components/sync-data-selection/sync-data-selection.component';
import { EmployeeSelectorsModule } from '../../@theme/components/header/selectors/employee/employee.module';
import { ReportsComponent } from './components/reports/reports.component';
import { BackNavigationModule } from '../../@shared/back-navigation/back-navigation.module';
import { HttpLoaderFactory } from '../../@theme/theme.module';

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
		Ng2SmartTableModule,
		UpworkRoutingModule,
		NbCardModule,
		NbButtonModule,
		NbInputModule,
		FormsModule,
		NbToggleModule,
		ReactiveFormsModule,
		NbDatepickerModule,
		NbCalendarKitModule,
		NbTooltipModule,
		NbIconModule,
		NbTabsetModule,
		NbRouteTabsetModule,
		TableComponentsModule,
		EmployeeSelectorsModule,
		NbCheckboxModule,
		NbActionsModule,
		NbContextMenuModule,
		BackNavigationModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	entryComponents: [SyncDataSelectionComponent]
})
export class UpworkModule {}
