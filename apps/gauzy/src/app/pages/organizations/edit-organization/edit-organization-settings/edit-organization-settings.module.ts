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
import { NgSelectModule } from '@ng-select/ng-select';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { EmployeeStore } from '../../../../@core/services/employee-store.service';
import { OrganizationContactService } from '../../../../@core/services/organization-contact.service';
import { OrganizationDepartmentsService } from '../../../../@core/services/organization-departments.service';
import { OrganizationEditStore } from '../../../../@core/services/organization-edit-store.service';
import { OrganizationPositionsService } from '../../../../@core/services/organization-positions';
import { OrganizationVendorsService } from '../../../../@core/services/organization-vendors.service';
import { EmployeeMultiSelectModule } from '../../../../@shared/employee/employee-multi-select/employee-multi-select.module';
import { EntityWithMembersModule } from '../../../../@shared/entity-with-members-card/entity-with-members-card.module';
import { ImageUploaderModule } from '../../../../@shared/image-uploader/image-uploader.module';
import { OrganizationsMutationModule } from '../../../../@shared/organizations/organizations-mutation/organizations-mutation.module';
import { RemoveLodashModule } from '../../../../@shared/remove-lodash/remove-lodash.module';
import { UserFormsModule } from '../../../../@shared/user/forms/user-forms.module';
import { EmployeeSelectorsModule } from '../../../../@theme/components/header/selectors/employee/employee.module';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { ColorPickerModule } from 'ngx-color-picker';
import { ThemeModule } from '../../../../@theme/theme.module';
import { OrganizationListComponent } from '../organization-list/organization-list.component';
import { EditOrganizationLocationComponent } from './edit-organization-location/edit-organization-location.component';
import { EditOrganizationMainComponent } from './edit-organization-main/edit-organization-main.component';
import { EditOrganizationOtherSettingsComponent } from './edit-organization-other-settings/edit-organization-other-settings.component';
import { EditOrganizationSettingsComponent } from './edit-organization-settings.component';
import { TagsColorInputModule } from '../../../../@shared/tags/tags-color-input/tags-color-input.module';
import { OrganizationExpenseCategoriesService } from '../../../../@core/services/organization-expense-categories.service';
import { InviteService } from '../../../../@core/services/invite.service';
import { TableComponentsModule } from '../../../../@shared/table-components/table-components.module';
import { FileUploaderModule } from '../../../../@shared/file-uploader-input/file-uploader-input.module';
import { SharedModule } from '../../../../@shared/shared.module';
import { TimerPickerModule } from '../../../../@shared/timer-picker/timer-picker.module';
import { CurrencyModule } from '../../../../@shared/currency/currency.module';
import { LocationFormModule } from '../../../../@shared/forms/location';
import { LeafletMapModule } from '../../../../@shared/forms/maps/leaflet/leaflet.module';
import { TimeZoneSelectorModule } from '../../../../@shared/selectors';

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
