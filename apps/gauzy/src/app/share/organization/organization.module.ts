import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule,
	NbListModule,
	NbTabsetModule,
	NbUserModule,
	NbTagModule
} from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../@theme/theme.module';
import { OrganizationComponent } from './organization.component';
import { OrganizationRoutingModule } from './organization-routing.module';
import { PublicPageMutationModule } from '../../@shared/organizations/public-page-mutation/public-page-mutation.module';
import { ImageUploaderModule } from '../../@shared/image-uploader/image-uploader.module';
import { SharedModule } from '../../@shared/shared.module';
import { TableComponentsModule } from '../../@shared';
import { WorkInProgressModule } from '../../pages/work-in-progress/work-in-progress.module';

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
		TranslateModule.forChild(),
		NbListModule,
		NbUserModule,
		NbTabsetModule,
		NbTagModule,
		SharedModule,
		TableComponentsModule,
		WorkInProgressModule
	],
	declarations: [OrganizationComponent],
	providers: []
})
export class OrganizationModule {}
