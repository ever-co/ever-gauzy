import { NgModule } from '@angular/core';
import { NbBadgeModule, NbButtonModule, NbCardModule, NbSpinnerModule } from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '@gauzy/ui-core/shared';
import { BillingRoutingModule } from './billing-routing.module';
import { BillingComponent } from './billing.component';

const NB_MODULES = [NbBadgeModule, NbButtonModule, NbCardModule, NbSpinnerModule];

@NgModule({
	imports: [
		...NB_MODULES,
		NgxPermissionsModule.forChild(),
		TranslateModule.forChild(),
		BillingRoutingModule,
		SharedModule
	],
	declarations: [BillingComponent],
	providers: []
})
export class BillingModule {}
