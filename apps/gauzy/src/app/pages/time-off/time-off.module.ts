import { HttpClient } from '@angular/common/http';
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
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
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
import { TimeOffStatusComponent } from './table-components/time-off-status.component';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

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
		NbRouteTabsetModule,
		NbCheckboxModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		NbSpinnerModule,
		TimeOffMutationModule
	],
	declarations: [
		TimeOffComponent,
		TimeOffSettingsComponent,
		RequestApprovalIcon,
		TimeOffStatusComponent,
		PaidIcon
	],
	entryComponents: [TimeOffSettingsComponent, TimeOffStatusComponent, RequestApprovalIcon, PaidIcon],
	providers: [OrganizationsService, TimeOffService]
})
export class TimeOffModule {}
