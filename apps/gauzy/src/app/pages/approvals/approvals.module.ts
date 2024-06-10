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
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { GauzyButtonActionModule, PaginationV2Module } from '@gauzy/ui-sdk/shared';
import { RequestApprovalService } from '@gauzy/ui-sdk/core';
import { ThemeModule } from '../../@theme/theme.module';
import { ApprovalsComponent } from './approvals.component';
import { SharedModule } from '../../@shared/shared.module';
import { ApprovalsRoutingModule } from './approvals-routing.module';
import { RequestApprovalMutationModule } from '../../@shared/approvals/approvals-mutation.module';
import { RequestApprovalActionComponent } from './table-components/request-approval-action/request-approval-action.component';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';

@NgModule({
	imports: [
		CommonModule,
		SharedModule,
		ThemeModule,
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
