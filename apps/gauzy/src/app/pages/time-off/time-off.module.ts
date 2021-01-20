import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
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
import { NgSelectModule } from '@ng-select/ng-select';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { OrganizationsService } from '../../@core/services/organizations.service';
import { ThemeModule } from '../../@theme/theme.module';
import { TimeOffComponent } from './time-off.component';
import { TimeOffRoutingModule } from './time-off-routing.module';
import { TimeOffSettingsComponent } from './time-off-settings/time-off-settings.component';
import { TimeOffMutationModule } from '../../@shared/time-off/time-off-mutation.module';
import { TimeOffService } from '../../@core/services/time-off.service';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { RequestApprovalIcon } from './table-components/request-approval-icon';
import { PaidIcon } from './table-components/paid-icon';
import { SharedModule } from '../../@shared/shared.module';
import { CardGridModule } from './../../@shared/card-grid/card-grid.module';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslaterModule } from '../../@shared/translater/translater.module';

@NgModule({
	imports: [
		SharedModule,
		TimeOffRoutingModule,
		ThemeModule,
		UserFormsModule,
		NbCardModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		Ng2SmartTableModule,
		NbDialogModule.forChild(),
		NbTooltipModule,
		NgSelectModule,
		NbRadioModule,
		NbSelectModule,
		NbBadgeModule,
		CardGridModule,
		NbRouteTabsetModule,
		NbCheckboxModule,
		TranslaterModule,
		NbSpinnerModule,
		TimeOffMutationModule,
		NgxPermissionsModule.forChild()
	],
	declarations: [
		TimeOffComponent,
		TimeOffSettingsComponent,
		RequestApprovalIcon,
		PaidIcon
	],
	entryComponents: [TimeOffSettingsComponent, RequestApprovalIcon, PaidIcon],
	providers: [OrganizationsService, TimeOffService]
})
export class TimeOffModule {}
