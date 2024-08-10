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
import { TranslateModule } from '@ngx-translate/core';
import {
	SmartDataViewLayoutModule,
	CardGridModule,
	RequestApprovalMutationModule,
	SharedModule
} from '@gauzy/ui-core/shared';
import { RequestApprovalService } from '@gauzy/ui-core/core';
import { ApprovalsComponent } from './approvals.component';
import { ApprovalsRoutingModule } from './approvals-routing.module';
import { RequestApprovalActionComponent } from './table-components/request-approval-action/request-approval-action.component';

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
		CardGridModule,
		NbTooltipModule,
		NbRadioModule,
		ApprovalsRoutingModule,
		SharedModule,
		RequestApprovalMutationModule,
		TranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		SmartDataViewLayoutModule
	],
	declarations: [ApprovalsComponent, RequestApprovalActionComponent],
	providers: [RequestApprovalService]
})
export class ApprovalsModule {}
