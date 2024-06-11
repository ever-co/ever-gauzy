import { NgModule } from '@angular/core';
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
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import {
	EmployeeStore,
	InviteService,
	OrganizationContactService,
	OrganizationDepartmentsService,
	OrganizationEditStore,
	OrganizationExpenseCategoriesService,
	OrganizationPositionsService,
	OrganizationVendorsService
} from '@gauzy/ui-sdk/core';
import {
	CurrencyModule,
	EmployeeMultiSelectModule,
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
} from '@gauzy/ui-sdk/shared';
import { EntityWithMembersModule } from '../../../../@shared/entity-with-members-card/entity-with-members-card.module';
import { ThemeModule } from '../../../../@theme/theme.module';
import { OrganizationListComponent } from '../organization-list/organization-list.component';
import { EditOrganizationLocationComponent } from './edit-organization-location/edit-organization-location.component';
import { EditOrganizationMainComponent } from './edit-organization-main/edit-organization-main.component';
import { EditOrganizationOtherSettingsComponent } from './edit-organization-other-settings/edit-organization-other-settings.component';
import { EditOrganizationSettingsComponent } from './edit-organization-settings.component';

@NgModule({
	imports: [
		NbBadgeModule,
		TableComponentsModule,
		TagsColorInputModule,
		ThemeModule,
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
		I18nTranslateModule.forChild(),
		Angular2SmartTableModule,
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
		TimeZoneSelectorModule
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
