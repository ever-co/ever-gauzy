import { NgModule } from '@angular/core';
import {
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import { SmartDataViewLayoutModule, SharedModule, TableComponentsModule } from '@gauzy/ui-core/shared';
import { IntegrationsRoutingModule } from './integrations-routing.module';
import { IntegrationsComponent } from './integrations.component';
import { IntegrationLayoutComponent } from './layout/layout.component';
import { IntegrationListComponent } from './components/integration-list/list.component';

const NB_MODULES = [
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTooltipModule
];

@NgModule({
	imports: [
		...NB_MODULES,
		NgxPermissionsModule.forChild(),
		TranslateModule.forChild(),
		IntegrationsRoutingModule,
		SharedModule,
		SmartDataViewLayoutModule,
		TableComponentsModule
	],
	declarations: [IntegrationLayoutComponent, IntegrationListComponent, IntegrationsComponent]
})
export class IntegrationsModule {}
