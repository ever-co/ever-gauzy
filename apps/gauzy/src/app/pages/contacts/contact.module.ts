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
	NbToggleModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { ThemeModule } from '../../@theme/theme.module';
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

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

const COMPONENTS = [
	ContactComponent,
	InviteContactComponent,
	ContactMutationComponent
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
		NgSelectModule,
		EntityWithMembersModule,
		TagsColorInputModule,
		EmployeeMultiSelectModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		NbToggleModule
	],

	declarations: [...COMPONENTS],
	entryComponents: [InviteContactComponent],
	providers: [
		OrganizationContactService,
		OrganizationProjectsService,
		InviteService
	]
})
export class ContactModule {}
