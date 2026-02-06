import { NgModule } from '@angular/core';

import {
	NbActionsModule,
	NbButtonModule,
	NbCalendarKitModule,
	NbCardModule,
	NbCheckboxModule,
	NbContextMenuModule,
	NbDatepickerModule,
	NbIconModule,
	NbInputModule,
	NbRouteTabsetModule,
	NbTabsetModule,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SmartDataViewLayoutModule, SelectorsModule, SharedModule, TableComponentsModule } from '@gauzy/ui-core/shared';
import { IntegrationUpworkRoutes } from './integration-upwork.routes';
import { UpworkComponent } from './components/upwork/upwork.component';
import { UpworkAuthorizeComponent } from './components/upwork-authorize/upwork-authorize.component';
import { TransactionsComponent } from './components/transactions/transactions.component';
import { ContractsComponent } from './components/contracts/contracts.component';
import { SyncDataSelectionComponent } from './components/sync-data-selection/sync-data-selection.component';
import { ReportsComponent } from './components/reports/reports.component';
import { IntegrationUpworkLayoutComponent } from './integration-upwork.layout.component';

const NB_MODULES = [
	NbActionsModule,
	NbButtonModule,
	NbCalendarKitModule,
	NbCardModule,
	NbCheckboxModule,
	NbContextMenuModule,
	NbDatepickerModule,
	NbIconModule,
	NbInputModule,
	NbRouteTabsetModule,
	NbTabsetModule,
	NbToggleModule,
	NbTooltipModule
];

@NgModule({
	declarations: [
		IntegrationUpworkLayoutComponent,
		UpworkComponent,
		UpworkAuthorizeComponent,
		TransactionsComponent,
		ContractsComponent,
		SyncDataSelectionComponent,
		ReportsComponent
	],
	imports: [
		...NB_MODULES,
		TranslateModule.forChild(),
		IntegrationUpworkRoutes,
		SmartDataViewLayoutModule,
		SelectorsModule,
		SharedModule,
		TableComponentsModule
	]
})
export class IntegrationUpworkUiModule {}
