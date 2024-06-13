import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import {
	CardGridModule,
	GauzyButtonActionModule,
	PaginationV2Module,
	RequestApprovalMutationModule,
	SharedModule
} from '@gauzy/ui-core/shared';
import { RequestApprovalService } from '@gauzy/ui-core/core';
import { ApprovalsComponent } from './approvals.component';
import { ApprovalsRoutingModule } from './approvals-routing.module';
import { RequestApprovalActionComponent } from './table-components/request-approval-action/request-approval-action.component';

@NgModule({
	imports: [
		CommonModule,
		SharedModule,
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
		Angular2SmartTableModule,
		CardGridModule,
		NbTooltipModule,
		NbRadioModule,
		ApprovalsRoutingModule,
		RequestApprovalMutationModule,
		I18nTranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		GauzyButtonActionModule,
		PaginationV2Module
	],
	declarations: [ApprovalsComponent, RequestApprovalActionComponent],
	providers: [RequestApprovalService]
})
export class ApprovalsModule {}
