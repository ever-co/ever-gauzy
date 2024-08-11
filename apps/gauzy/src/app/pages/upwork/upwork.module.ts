import { NgModule } from '@angular/core';
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
import { TranslateModule } from '@ngx-translate/core';
import { SmartDataViewLayoutModule, SelectorsModule, SharedModule, TableComponentsModule } from '@gauzy/ui-core/shared';
import { UpworkComponent } from './components/upwork/upwork.component';
import { UpworkRoutingModule } from './upwork-routing.module';
import { UpworkAuthorizeComponent } from './components/upwork-authorize/upwork-authorize.component';
import { TransactionsComponent } from './components/transactions/transactions.component';
import { ContractsComponent } from './components/contracts/contracts.component';
import { SyncDataSelectionComponent } from './components/sync-data-selection/sync-data-selection.component';
import { ReportsComponent } from './components/reports/reports.component';

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
		TranslateModule.forChild(),
		SharedModule,
		SmartDataViewLayoutModule,
		TableComponentsModule,
		SelectorsModule
	]
})
export class UpworkModule {}
