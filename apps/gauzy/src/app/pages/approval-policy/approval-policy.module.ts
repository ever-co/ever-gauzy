import { CardGridModule } from './../../@shared/card-grid/card-grid.module';
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
import { ApprovalPolicyComponent } from './approval-policy.component';
import { SharedModule } from '../../@shared/shared.module';
import { ApprovalPolicyRoutingModule } from './approval-policy-routing.module';
import { ApprovalPolicyService } from '@gauzy/ui-sdk/core';
import { ApprovalPolicyMutationModule } from '../../@shared/approval-policy/approval-policy-mutation.module';
import { BackNavigationModule } from '../../@shared/back-navigation/back-navigation.module';
import { NgxPermissionsModule } from 'ngx-permissions';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';
import { GauzyButtonActionModule } from '@gauzy/ui-sdk/shared';
import { PaginationV2Module } from '@gauzy/ui-sdk/shared';

@NgModule({
	imports: [
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
		NbTooltipModule,
		NbRadioModule,
		CardGridModule,
		ApprovalPolicyMutationModule,
		ApprovalPolicyRoutingModule,
		BackNavigationModule,
		I18nTranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		HeaderTitleModule,
		GauzyButtonActionModule,
		PaginationV2Module
	],
	declarations: [ApprovalPolicyComponent],
	providers: [ApprovalPolicyService]
})
export class ApprovalPolicyModule {}
