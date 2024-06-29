import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	NbCardModule,
	NbSelectModule,
	NbInputModule,
	NbSpinnerModule,
	NbButtonModule,
	NbIconModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import {
	GauzyButtonActionModule,
	NoDataMessageModule,
	SharedModule,
	TableComponentsModule
} from '@gauzy/ui-core/shared';
import { IntegrationsRoutingModule } from './integrations-routing.module';
import { IntegrationsComponent } from './integrations.component';
import { IntegrationLayoutComponent } from './layout/layout.component';
import { IntegrationListComponent } from './components/integration-list/list.component';

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbCardModule,
		NbInputModule,
		NbSelectModule,
		NbSpinnerModule,
		NbTooltipModule,
		IntegrationsRoutingModule,
		SharedModule,
		I18nTranslateModule.forChild(),
		NbIconModule,
		NgxPermissionsModule.forChild(),
		GauzyButtonActionModule,
		TableComponentsModule,
		NoDataMessageModule
	],
	declarations: [IntegrationLayoutComponent, IntegrationListComponent, IntegrationsComponent]
})
export class IntegrationsModule {}
