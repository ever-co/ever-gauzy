import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbTooltipModule,
	NbSelectModule,
	NbToggleModule,
	NbSpinnerModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpLoaderFactory, ThemeModule } from '../../@theme/theme.module';
import { SharedModule } from '../../@shared/shared.module';
import { FileUploaderModule } from '../../@shared/file-uploader-input/file-uploader-input.module';
import { EntityWithMembersModule } from '../../@shared/entity-with-members-card/entity-with-members-card.module';
import { TagsColorInputModule } from '../../@shared/tags/tags-color-input/tags-color-input.module';
import { EmployeeMultiSelectModule } from '../../@shared/employee/employee-multi-select/employee-multi-select.module';
import { ContactComponent } from './contact.component';
import { ContactMutationComponent } from './contact-mutation/contact-mutation.component';
import { ContactRoutingModule } from './contact-routing.module';
import { OrganizationContactService } from '../../@core/services/organization-contact.service';
import { OrganizationProjectsService } from '../../@core/services/organization-projects.service';
import { InviteService } from '../../@core/services/invite.service';
import { InviteContactComponent } from './invite-contact/invite-contact.component';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { ClientsComponent } from './clients/clients.component';
import { LeadsComponent } from './leads/leads.component';
import { CustomersComponent } from './customers/customers.component';
import { ImageUploaderModule } from '../../@shared/image-uploader/image-uploader.module';
import { ContactActionComponent } from './table-components/contact-action/contact-action.component';
import { LocationFormModule } from '../../@shared/forms/location';

const COMPONENTS = [
	ContactComponent,
	InviteContactComponent,
	ContactMutationComponent,
	ContactMutationComponent,
	ClientsComponent,
	CustomersComponent,
	LeadsComponent,
	ContactActionComponent
];

@NgModule({
	imports: [
		SharedModule,
		ThemeModule,
		ContactRoutingModule,
		NbCardModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbSelectModule,
		NbIconModule,
		NbDialogModule.forChild(),
		NbTooltipModule,
		FileUploaderModule,
		CardGridModule,
		Ng2SmartTableModule,
		NgSelectModule,
		EntityWithMembersModule,
		TagsColorInputModule,
		Ng2SmartTableModule,
		ImageUploaderModule,
		EmployeeMultiSelectModule,
		NbSpinnerModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		NbToggleModule,
		LocationFormModule
	],

	declarations: [...COMPONENTS],
	entryComponents: [
		ContactComponent,
		InviteContactComponent,
		ContactMutationComponent,
		ClientsComponent,
		CustomersComponent,
		LeadsComponent
	],
	providers: [
		OrganizationContactService,
		OrganizationProjectsService,
		InviteService
	]
})
export class ContactModule {}
