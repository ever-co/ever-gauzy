import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
	NbTooltipModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { NgSelectModule } from '@ng-select/ng-select';
import { ClipboardModule } from 'ngx-clipboard';
import { TranslatePipe } from '@ngx-translate/core';
import { CardGridModule } from '../../card-grid/card-grid.module';
import { SharedModule } from '../../shared.module';
import { SmartDataViewLayoutModule } from '../../smart-data-layout/smart-data-view-layout.module';
import { UserFormsModule } from '../../user/forms/user-forms.module';
import { InviteMutationModule } from '../invite-mutation/invite-mutation.module';
import { InvitesComponent } from './invites.component';
import { ProjectNamesComponent } from './project-names/project-names.component';
import { ResendConfirmationComponent } from './resend-confirmation/resend-confirmation.component';
import { ClientNamesComponent } from './client-names/client-names.component';
import { DepartmentNamesComponent } from './department-names/department-names.component';
import { InviteDeleteConfirmationComponent } from './invite-delete-confirmation/invite-delete-confirmation.component';

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
	NbTooltipModule
];

// Components
const COMPONENTS = [
	InvitesComponent,
	ProjectNamesComponent,
	ClientNamesComponent,
	DepartmentNamesComponent,
	ResendConfirmationComponent,
	InviteDeleteConfirmationComponent
];

@NgModule({
	imports: [
		...NB_MODULES,
		FormsModule,
		NgSelectModule,
		ClipboardModule,
		TranslatePipe,
		NgxPermissionsModule.forChild(),
		SharedModule,
		SmartDataViewLayoutModule,
		InviteMutationModule,
		UserFormsModule,
		CardGridModule
	],
	declarations: [...COMPONENTS],
	exports: [...COMPONENTS]
})
export class InviteTableModule {}
