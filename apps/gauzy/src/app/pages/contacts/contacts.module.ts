import { NgModule } from '@angular/core';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbTooltipModule,
	NbSelectModule,
	NbToggleModule,
	NbSpinnerModule,
	NbStepperModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import { InviteService, OrganizationContactService, OrganizationProjectsService } from '@gauzy/ui-core/core';
import {
	SmartDataViewLayoutModule,
	CardGridModule,
	EmployeeMultiSelectModule,
	FileUploaderModule,
	ImageUploaderModule,
	LeafletMapModule,
	LocationFormModule,
	SharedModule,
	TagsColorInputModule
} from '@gauzy/ui-core/shared';
import { ContactMutationComponent } from './contact-mutation/contact-mutation.component';
import { ContactsRoutingModule } from './contacts-routing.module';
import { ContactsComponent } from './contacts.component';
import { InviteContactComponent } from './invite-contact/invite-contact.component';
import { ContactActionComponent } from './table-components';

const COMPONENTS = [ContactsComponent, InviteContactComponent, ContactMutationComponent, ContactActionComponent];

@NgModule({
	imports: [
		NbButtonModule,
		NbCardModule,
		NbDialogModule.forChild(),
		NbIconModule,
		NbInputModule,
		NbSelectModule,
		NbSpinnerModule,
		NbStepperModule,
		NbToggleModule,
		NbTooltipModule,
		NgSelectModule,
		CardGridModule,
		ContactsRoutingModule,
		EmployeeMultiSelectModule,
		FileUploaderModule,
		ImageUploaderModule,
		LeafletMapModule,
		LocationFormModule,
		SmartDataViewLayoutModule,
		SharedModule,
		TagsColorInputModule,
		TranslateModule.forChild(),
		NgxPermissionsModule.forChild()
	],

	declarations: [...COMPONENTS],
	providers: [OrganizationContactService, OrganizationProjectsService, InviteService]
})
export class ContactsModule {}
