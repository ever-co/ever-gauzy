import { NgModule } from '@angular/core';
import {
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbRouteTabsetModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTooltipModule,
	NbRadioModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslatePipe } from '@ngx-translate/core';
import { ApprovalPolicyService } from '@gauzy/ui-core/core';
import {
	SmartDataViewLayoutModule,
	ApprovalPolicyMutationModule,
	CardGridModule,
	SharedModule
} from '@gauzy/ui-core/shared';
import { ApprovalPolicyComponent } from './approval-policy.component';
import { ApprovalPolicyRoutingModule } from './approval-policy-routing.module';

@NgModule({
	imports: [
		NbBadgeModule,
		NbButtonModule,
		NbCardModule,
		NbCheckboxModule,
		NbDialogModule.forChild(),
		NbIconModule,
		NbInputModule,
		NbRouteTabsetModule,
		NbSelectModule,
		NbSpinnerModule,
		NbTooltipModule,
		NbRadioModule,
		SharedModule,
		CardGridModule,
		ApprovalPolicyMutationModule,
		ApprovalPolicyRoutingModule,
		TranslatePipe,
		NgxPermissionsModule.forChild(),
		SmartDataViewLayoutModule
	],
	declarations: [ApprovalPolicyComponent],
	providers: [ApprovalPolicyService]
})
export class ApprovalPolicyModule {}
