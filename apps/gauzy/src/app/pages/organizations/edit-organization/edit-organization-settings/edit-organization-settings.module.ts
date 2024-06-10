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
import { CurrencyModule, LeafletMapModule, LocationFormModule, TimeZoneSelectorModule } from '@gauzy/ui-sdk/shared';
import { EmployeeMultiSelectModule } from '../../../../@shared/employee/employee-multi-select/employee-multi-select.module';
import { EntityWithMembersModule } from '../../../../@shared/entity-with-members-card/entity-with-members-card.module';
import { ImageUploaderModule } from '../../../../@shared/image-uploader/image-uploader.module';
import { OrganizationsMutationModule } from '../../../../@shared/organizations/organizations-mutation/organizations-mutation.module';
import { RemoveLodashModule } from '../../../../@shared/remove-lodash/remove-lodash.module';
import { UserFormsModule } from '../../../../@shared/user/forms/user-forms.module';
import { EmployeeSelectorsModule } from '../../../../@theme/components/header/selectors/employee/employee.module';
import { ThemeModule } from '../../../../@theme/theme.module';
import { OrganizationListComponent } from '../organization-list/organization-list.component';
import { EditOrganizationLocationComponent } from './edit-organization-location/edit-organization-location.component';
import { EditOrganizationMainComponent } from './edit-organization-main/edit-organization-main.component';
import { EditOrganizationOtherSettingsComponent } from './edit-organization-other-settings/edit-organization-other-settings.component';
import { EditOrganizationSettingsComponent } from './edit-organization-settings.component';
import { TagsColorInputModule } from '../../../../@shared/tags/tags-color-input/tags-color-input.module';
import { TableComponentsModule } from '@gauzy/ui-sdk/shared';
import { FileUploaderModule } from '../../../../@shared/file-uploader-input/file-uploader-input.module';
import { SharedModule } from '../../../../@shared/shared.module';
import { TimerPickerModule } from '../../../../@shared/timer-picker/timer-picker.module';

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
		EmployeeSelectorsModule,
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
