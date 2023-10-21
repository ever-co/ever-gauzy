import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import {
	NbCardModule,
	NbSelectModule,
	NbInputModule,
	NbSpinnerModule,
	NbButtonModule,
	NbIconModule
} from '@nebular/theme';
import { IntegrationsRoutingModule } from './integrations-routing.module';
import { IntegrationsComponent } from './integrations.component';
import { SharedModule } from '../../@shared/shared.module';
import { TranslateModule } from '../../@shared/translate/translate.module';
import { IntegrationLayoutComponent } from './layout/layout.component';
import { IntegrationListComponent } from './components/integration-list/list.component';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { NgxPermissionsModule } from "ngx-permissions";
import {GauzyButtonActionModule} from "../../@shared/gauzy-button-action/gauzy-button-action.module";
import {TableComponentsModule} from "../../@shared";

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbCardModule,
		NbInputModule,
		NbSelectModule,
		NbSpinnerModule,
		Ng2SmartTableModule,
		IntegrationsRoutingModule,
		SharedModule,
		TranslateModule,
		HeaderTitleModule,
		NbIconModule,
		NgxPermissionsModule.forChild(),
		GauzyButtonActionModule,
		TableComponentsModule,
	],
	declarations: [
		IntegrationLayoutComponent,
		IntegrationListComponent,
		IntegrationsComponent,
	],
})
export class IntegrationsModule {}
