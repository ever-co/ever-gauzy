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
	NbTooltipModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { NgSelectModule } from '@ng-select/ng-select';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { ClipboardModule } from 'ngx-clipboard';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { GauzyButtonActionModule, PaginationV2Module, SharedModule, UserFormsModule } from '@gauzy/ui-sdk/shared';
import { InviteMutationModule } from '../invite-mutation/invite-mutation.module';
import { InvitesComponent } from './invites.component';
import { ProjectNamesComponent } from './project-names/project-names.component';
import { ResendConfirmationComponent } from './resend-confirmation/resend-confirmation.component';
import { ClientNamesComponent } from './client-names/client-names.component';
import { DepartmentNamesComponent } from './department-names/department-names.component';
import { CardGridModule } from '../../card-grid/card-grid.module';

const COMPONENTS = [
	InvitesComponent,
	ProjectNamesComponent,
	ClientNamesComponent,
	DepartmentNamesComponent,
	ResendConfirmationComponent
];

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		Angular2SmartTableModule,
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
		NgSelectModule,
		ClipboardModule,
		I18nTranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		SharedModule,
		InviteMutationModule,
		UserFormsModule,
		CardGridModule,
		GauzyButtonActionModule,
		PaginationV2Module
	],
	declarations: [...COMPONENTS],
	exports: [...COMPONENTS]
})
export class InviteTableModule {}
