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
import { TranslateModule } from '@ngx-translate/core';
import { CardGridModule } from '../../card-grid/card-grid.module';
import { SharedModule } from '../../shared.module';
import { UserFormsModule } from '../../user/forms/user-forms.module';
import { GauzyButtonActionModule } from '../../gauzy-button-action/gauzy-button-action.module';
import { PaginationV2Module } from '../../smart-table/pagination/pagination-v2/pagination-v2.module';
import { InviteMutationModule } from '../invite-mutation/invite-mutation.module';
import { InvitesComponent } from './invites.component';
import { ProjectNamesComponent } from './project-names/project-names.component';
import { ResendConfirmationComponent } from './resend-confirmation/resend-confirmation.component';
import { ClientNamesComponent } from './client-names/client-names.component';
import { DepartmentNamesComponent } from './department-names/department-names.component';

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
		TranslateModule.forChild(),
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
