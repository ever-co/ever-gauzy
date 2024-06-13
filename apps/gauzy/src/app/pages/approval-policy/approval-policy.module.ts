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
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { NgxPermissionsModule } from 'ngx-permissions';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ApprovalPolicyService } from '@gauzy/ui-sdk/core';
import {
	ApprovalPolicyMutationModule,
	CardGridModule,
	GauzyButtonActionModule,
	PaginationV2Module,
	SharedModule
} from '@gauzy/ui-sdk/shared';
import { ApprovalPolicyComponent } from './approval-policy.component';
import { ApprovalPolicyRoutingModule } from './approval-policy-routing.module';

@NgModule({
	imports: [
		SharedModule,
		CommonModule,
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
		NbTooltipModule,
		NbRadioModule,
		CardGridModule,
		ApprovalPolicyMutationModule,
		ApprovalPolicyRoutingModule,
		I18nTranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		GauzyButtonActionModule,
		PaginationV2Module
	],
	declarations: [ApprovalPolicyComponent],
	providers: [ApprovalPolicyService]
})
export class ApprovalPolicyModule {}
