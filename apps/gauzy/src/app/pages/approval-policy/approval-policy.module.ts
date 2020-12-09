import { CardGridModule } from './../../@shared/card-grid/card-grid.module';
import { NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
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
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { HttpLoaderFactory, ThemeModule } from '../../@theme/theme.module';
import { ApprovalPolicyComponent } from './approval-policy.component';
import { SharedModule } from '../../@shared/shared.module';
import { ApprovalPolicyRoutingModule } from './approval-policy-routing.module';
import { ApprovalPolicyService } from '../../@core/services/approval-policy.service';
import { ApprovalPolicyMutationModule } from '../../@shared/approval-policy/approval-policy-mutation.module';
import { BackNavigationModule } from '../../@shared/back-navigation/back-navigation.module';
import { NgxPermissionsModule } from 'ngx-permissions';

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
		Ng2SmartTableModule,
		NbTooltipModule,
		NbRadioModule,
		CardGridModule,
		ApprovalPolicyMutationModule,
		ApprovalPolicyRoutingModule,
		BackNavigationModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		NgxPermissionsModule.forChild()
	],
	declarations: [ApprovalPolicyComponent],
	entryComponents: [],
	providers: [ApprovalPolicyService]
})
export class ApprovalPolicyModule {}
