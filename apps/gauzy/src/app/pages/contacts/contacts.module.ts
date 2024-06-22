import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
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
	NbSpinnerModule,
	NbStepperModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { NgxPermissionsModule } from 'ngx-permissions';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { InviteService, OrganizationContactService, OrganizationProjectsService } from '@gauzy/ui-core/core';
import {
	CardGridModule,
	EmployeeMultiSelectModule,
	FileUploaderModule,
	i4netButtonActionModule,
	ImageUploaderModule,
	LeafletMapModule,
	LocationFormModule,
	PaginationV2Module,
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
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
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
		Angular2SmartTableModule,
		NgSelectModule,
		CardGridModule,
		ContactsRoutingModule,
		EmployeeMultiSelectModule,
		FileUploaderModule,
		i4netButtonActionModule,
		ImageUploaderModule,
		LeafletMapModule,
		LocationFormModule,
		PaginationV2Module,
		SharedModule,
		TagsColorInputModule,
		I18nTranslateModule.forChild(),
		NgxPermissionsModule.forChild()
	],

	declarations: [...COMPONENTS],
	providers: [OrganizationContactService, OrganizationProjectsService, InviteService]
})
export class ContactsModule { }
