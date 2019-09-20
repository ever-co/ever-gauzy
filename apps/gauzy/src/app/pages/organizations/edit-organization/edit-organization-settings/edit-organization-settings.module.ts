import { NgModule } from '@angular/core';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule,
	NbSelectModule,
	NbListModule,
	NbTabsetModule,
	NbActionsModule
} from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { EditOrganizationSettingsComponent } from './edit-organization-settings.component';
import { EditOrganizationMainComponent } from './edit-organization-main/edit-organization-main.component';
import {
	ThemeModule,
	HttpLoaderFactory
} from '../../../../@theme/theme.module';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { OrganizationsMutationModule } from 'apps/gauzy/src/app/@shared/organizations/organizations-mutation/organizations-mutation.module';
import { UserFormsModule } from 'apps/gauzy/src/app/@shared/user/forms/user-forms.module';
import { ImageUpladerModule } from 'apps/gauzy/src/app/@shared/image-uploader/image-uploader.module';
import { RemoveLodashModule } from 'apps/gauzy/src/app/@shared/remove-lodash/remove-lodash.module';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { OrganizationListComponent } from '../organization-list/organization-list.component';
import { EditOrganizationDepartmentsComponent } from './edit-organization-departments/edit-organization-departments.component';
import { OrganizationDepartmentsService } from 'apps/gauzy/src/app/@core/services/organization-departments.service';
import { EditOrganizationVendorsComponent } from './edit-organization-vendors/edit-organization-vendors.component';
import { OrganizationVendorsService } from 'apps/gauzy/src/app/@core/services/organization-vendors.service';
import { EditOrganizationPositionsComponent } from './edit-organization-positions/edit-organization-positions.component';
import { OrganizationPositionsService } from 'apps/gauzy/src/app/@core/services/organization-positions';
import { EditOrganizationClientsComponent } from './edit-organization-clients/edit-organization-clients.component';
import { OrganizationClientsService } from 'apps/gauzy/src/app/@core/services/organization-clients.service ';

@NgModule({
	imports: [
		ThemeModule,
		NbCardModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		NbActionsModule,
		NbDialogModule.forChild(),
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		Ng2SmartTableModule,
		OrganizationsMutationModule,
		UserFormsModule,
		ImageUpladerModule,
		NbSelectModule,
		RemoveLodashModule,
		NbListModule,
		NbTabsetModule
	],
	providers: [
		OrganizationDepartmentsService,
		OrganizationVendorsService,
		OrganizationPositionsService,
		OrganizationClientsService
	],
	declarations: [
		EditOrganizationSettingsComponent,
		EditOrganizationMainComponent,
		OrganizationListComponent,
		EditOrganizationDepartmentsComponent,
		EditOrganizationVendorsComponent,
		EditOrganizationPositionsComponent,
		EditOrganizationPositionsComponent,
		EditOrganizationClientsComponent
	]
})
export class EditOrganizationSettingsModule {}
