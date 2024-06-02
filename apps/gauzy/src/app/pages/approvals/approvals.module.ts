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
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { ThemeModule } from '../../@theme/theme.module';
import { ApprovalsComponent } from './approvals.component';
import { SharedModule } from '../../@shared/shared.module';
import { ApprovalsRoutingModule } from './approvals-routing.module';
import { RequestApprovalService } from '../../@core/services/request-approval.service';
import { RequestApprovalMutationModule } from '../../@shared/approvals/approvals-mutation.module';
import { RequestApprovalActionComponent } from './table-components/request-approval-action/request-approval-action.component';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { CommonModule } from '@angular/common';
import { NgxPermissionsModule } from 'ngx-permissions';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';
import { GauzyButtonActionModule } from '../../@shared/gauzy-button-action/gauzy-button-action.module';
import { PaginationV2Module } from '../../@shared/pagination/pagination-v2/pagination-v2.module';

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
		HeaderTitleModule,
		GauzyButtonActionModule,
		PaginationV2Module
	],
	declarations: [ApprovalsComponent, RequestApprovalActionComponent],
	providers: [RequestApprovalService]
})
export class ApprovalsModule {}
