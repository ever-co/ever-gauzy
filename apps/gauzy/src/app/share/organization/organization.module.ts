import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule,
	NbListModule,
	NbUserModule,
	NbTabsetModule
} from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { OrganizationComponent } from './organization.component';
import { OrganizationRoutingModule } from './organization-routing.module';
import { PublicPageMutationModule } from '../../@shared/organizations/public-page-mutation/public-page-mutation.module';
import { ImageUploaderModule } from '../../@shared/image-uploader/image-uploader.module';
import { TranslateModule } from '../../@shared/translate/translate.module';

@NgModule({
	imports: [
		OrganizationRoutingModule,
		ThemeModule,
		NbCardModule,
		NbDialogModule.forChild(),
		FormsModule,
		ReactiveFormsModule,
		ImageUploaderModule,
		NbButtonModule,
		NbIconModule,
		NbInputModule,
		PublicPageMutationModule,
		TranslateModule,
		NbListModule,
		NbUserModule,
		NbTabsetModule
	],
	declarations: [OrganizationComponent],
	providers: []
})
export class OrganizationModule {}
