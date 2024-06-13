import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import {
	ImageUploaderModule,
	PublicPageMutationModule,
	SharedModule,
	TableComponentsModule
} from '@gauzy/ui-core/shared';
import { OrganizationComponent } from './organization.component';
import { OrganizationRoutingModule } from './organization-routing.module';
import { WorkInProgressModule } from '../../pages/work-in-progress/work-in-progress.module';

@NgModule({
	imports: [
		CommonModule,
		OrganizationRoutingModule,
		NbCardModule,
		NbDialogModule.forChild(),
		FormsModule,
		ReactiveFormsModule,
		ImageUploaderModule,
		NbButtonModule,
		NbIconModule,
		NbInputModule,
		PublicPageMutationModule,
		I18nTranslateModule.forChild(),
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
