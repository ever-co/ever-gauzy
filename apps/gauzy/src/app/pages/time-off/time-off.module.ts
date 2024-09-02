import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
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
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import { OrganizationsService, TimeOffService } from '@gauzy/ui-core/core';
import {
	SmartDataViewLayoutModule,
	CardGridModule,
	SharedModule,
	TimeOffMutationModule,
	UserFormsModule,
	TableComponentsModule
} from '@gauzy/ui-core/shared';
import { routes } from './time-off.routes';
import { TimeOffComponent } from './time-off.component';
import { PaidIcon, RequestApprovalIcon } from './table-components';
import { TimeOffSettingsComponent } from './time-off-settings/time-off-settings.component';

// Nebular Modules
const NB_MODULES = [
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
	NbTooltipModule,
	NbRadioModule,
	NbToggleModule
];

// Third Party Modules
const THIRD_PARTY_MODULES = [NgSelectModule, NgxPermissionsModule.forChild(), TranslateModule.forChild()];

@NgModule({
	imports: [
		RouterModule.forChild(routes),
		...NB_MODULES,
		...THIRD_PARTY_MODULES,
		SharedModule,
		UserFormsModule,
		TimeOffMutationModule,
		CardGridModule,
		SmartDataViewLayoutModule,
		TableComponentsModule
	],
	declarations: [TimeOffComponent, TimeOffSettingsComponent, RequestApprovalIcon, PaidIcon],
	providers: [OrganizationsService, TimeOffService]
})
export class TimeOffModule {}
