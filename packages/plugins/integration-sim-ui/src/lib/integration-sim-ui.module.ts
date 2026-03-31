import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbActionsModule,
	NbAlertModule,
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbContextMenuModule,
	NbIconModule,
	NbInputModule,
	NbListModule,
	NbRouteTabsetModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SmartDataViewLayoutModule, SelectorsModule, SharedModule, TableComponentsModule } from '@gauzy/ui-core/shared';
import { IntegrationSimRoutes } from './integration-sim.routes';
import { IntegrationSimLayoutComponent } from './integration-sim.layout.component';
import { SimAuthorizeComponent } from './components/sim-authorize/sim-authorize.component';
import { SimComponent } from './components/sim/sim.component';
import { SimExecutionsComponent } from './components/sim-executions/sim-executions.component';
import { SimWorkflowsComponent } from './components/sim-workflows/sim-workflows.component';
import { SimEventTriggersComponent } from './components/sim-event-triggers/sim-event-triggers.component';

@NgModule({
	declarations: [
		IntegrationSimLayoutComponent,
		SimAuthorizeComponent,
		SimComponent,
		SimExecutionsComponent,
		SimWorkflowsComponent,
		SimEventTriggersComponent
	],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbActionsModule,
		NbAlertModule,
		NbBadgeModule,
		NbButtonModule,
		NbCardModule,
		NbContextMenuModule,
		NbIconModule,
		NbInputModule,
		NbListModule,
		NbRouteTabsetModule,
		NbSelectModule,
		NbSpinnerModule,
		NbTabsetModule,
		NbToggleModule,
		NbTooltipModule,
		TranslateModule.forChild(),
		IntegrationSimRoutes,
		SmartDataViewLayoutModule,
		SelectorsModule,
		SharedModule,
		TableComponentsModule
	]
})
export class IntegrationSimUiModule {}
