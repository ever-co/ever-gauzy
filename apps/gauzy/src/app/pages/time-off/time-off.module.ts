import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
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
	NbRadioModule,
	NbToggleModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import { OrganizationsService, TimeOffService } from '@gauzy/ui-core/core';
import {
	CardGridModule,
	GauzyButtonActionModule,
	PaginationV2Module,
	SharedModule,
	TimeOffMutationModule,
	UserFormsModule
} from '@gauzy/ui-core/shared';
import { TimeOffComponent } from './time-off.component';
import { TimeOffRoutingModule } from './time-off-routing.module';
import { TimeOffSettingsComponent } from './time-off-settings/time-off-settings.component';
import { RequestApprovalIcon } from './table-components/request-approval-icon';
import { PaidIcon } from './table-components/paid-icon';

@NgModule({
	imports: [
		CommonModule,
		SharedModule,
		TimeOffRoutingModule,
		UserFormsModule,
		NbCardModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		Angular2SmartTableModule,
		NbDialogModule.forChild(),
		NbTooltipModule,
		NgSelectModule,
		NbRadioModule,
		NbSelectModule,
		NbBadgeModule,
		CardGridModule,
		NbRouteTabsetModule,
		NbCheckboxModule,
		TranslateModule.forChild(),
		NbSpinnerModule,
		TimeOffMutationModule,
		NgxPermissionsModule.forChild(),
		GauzyButtonActionModule,
		PaginationV2Module,
		NbToggleModule
	],
	declarations: [TimeOffComponent, TimeOffSettingsComponent, RequestApprovalIcon, PaidIcon],
	providers: [OrganizationsService, TimeOffService]
})
export class TimeOffModule {}
