import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbActionsModule,
	NbButtonModule,
	NbCardModule,
	NbDatepickerModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbListModule,
	NbRouteTabsetModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbToggleModule,
	NbBadgeModule,
	NbTooltipModule,
	NbAccordionModule
} from '@nebular/theme';
import { ColorPickerModule } from 'ngx-color-picker';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import {
	EmployeeStore,
	InviteService,
	OrganizationContactService,
	OrganizationDepartmentsService,
	OrganizationEditStore,
	OrganizationExpenseCategoriesService,
	OrganizationPositionsService,
	OrganizationVendorsService
} from '@gauzy/ui-core/core';
import {
	SmartDataViewLayoutModule,
	CurrencyModule,
	EmployeeMultiSelectModule,
	EntityWithMembersModule,
	FileUploaderModule,
	ImageUploaderModule,
	LeafletMapModule,
	LocationFormModule,
	OrganizationsMutationModule,
	RemoveLodashModule,
	SharedModule,
	TableComponentsModule,
	TagsColorInputModule,
	TimeZoneSelectorModule,
	TimerPickerModule,
	UserFormsModule
} from '@gauzy/ui-core/shared';
import { OrganizationListComponent } from '../organization-list/organization-list.component';
import { EditOrganizationLocationComponent } from './edit-organization-location/edit-organization-location.component';
import { EditOrganizationMainComponent } from './edit-organization-main/edit-organization-main.component';
import { EditOrganizationOtherSettingsComponent } from './edit-organization-other-settings/edit-organization-other-settings.component';
import { EditOrganizationSettingsComponent } from './edit-organization-settings.component';

@NgModule({
	imports: [
		CommonModule,
		NbBadgeModule,
		TableComponentsModule,
		TagsColorInputModule,
		NbCardModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		NbSpinnerModule,
		NbActionsModule,
		NgSelectModule,
		ColorPickerModule,
		NbTooltipModule,
		NbDialogModule.forChild(),
		TranslateModule.forChild(),
		OrganizationsMutationModule,
		UserFormsModule,
		ImageUploaderModule,
		NbSelectModule,
		RemoveLodashModule,
		NbListModule,
		NbTabsetModule,
		NbRouteTabsetModule,
		NbDatepickerModule,
		NbToggleModule,
		EntityWithMembersModule,
		EmployeeMultiSelectModule,
		TagsColorInputModule,
		FileUploaderModule,
		SharedModule,
		TimerPickerModule,
		CurrencyModule,
		LocationFormModule,
		LeafletMapModule,
		NbAccordionModule,
		TimeZoneSelectorModule,
		SmartDataViewLayoutModule
	],
	providers: [
		OrganizationDepartmentsService,
		OrganizationVendorsService,
		OrganizationExpenseCategoriesService,
		OrganizationPositionsService,
		OrganizationContactService,
		OrganizationEditStore,
		EmployeeStore,
		InviteService
	],
	declarations: [
		EditOrganizationSettingsComponent,
		EditOrganizationMainComponent,
		EditOrganizationLocationComponent,
		OrganizationListComponent,
		EditOrganizationOtherSettingsComponent
	],
	exports: [EditOrganizationSettingsComponent]
})
export class EditOrganizationSettingsModule {}
