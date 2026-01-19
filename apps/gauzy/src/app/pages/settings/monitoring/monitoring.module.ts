import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {
	NbAccordionModule,
	NbButtonModule,
	NbCardModule,
	NbInputModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbToggleModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { TenantService } from '@gauzy/ui-core/core';
import { SharedModule } from '@gauzy/ui-core/shared';
import { MonitoringComponent } from './monitoring.component';

const routes: Routes = [
	{
		path: '',
		component: MonitoringComponent
	}
];

@NgModule({
	imports: [
		RouterModule.forChild(routes),
		NbAccordionModule,
		NbButtonModule,
		NbCardModule,
		NbInputModule,
		NbSpinnerModule,
		NbTabsetModule,
		NbToggleModule,
		TranslateModule.forChild(),
		SharedModule
	],
	declarations: [MonitoringComponent],
	providers: [TenantService]
})
export class MonitoringModule {}
