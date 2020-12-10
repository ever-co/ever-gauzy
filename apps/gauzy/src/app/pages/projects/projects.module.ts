import { NgModule } from '@angular/core';
import { HttpLoaderFactory, ThemeModule } from '../../@theme/theme.module';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule,
	NbActionsModule,
	NbToggleModule,
	NbSelectModule,
	NbDatepickerModule,
	NbSpinnerModule,
	NbTabsetModule
} from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { ProjectsRoutingModule } from './projects-routing.module';
import { ProjectsComponent } from './projects.component';
import { TagsColorInputModule } from '../../@shared/tags/tags-color-input/tags-color-input.module';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { OrganizationProjectsService } from '../../@core/services/organization-projects.service';
import { ProjectsMutationComponent } from './projects-mutation/projects-mutation.component';
import { RemoveLodashModule } from '../../@shared/remove-lodash/remove-lodash.module';
import { EntityWithMembersModule } from '../../@shared/entity-with-members-card/entity-with-members-card.module';
import { OrganizationContactService } from '../../@core/services/organization-contact.service';
import { SharedModule } from '../../@shared/shared.module';
import { NgSelectModule } from '@ng-select/ng-select';
import { OrganizationsMutationModule } from '../../@shared/organizations/organizations-mutation/organizations-mutation.module';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { ImageUploaderModule } from '../../@shared/image-uploader/image-uploader.module';
import { EmployeeSelectorsModule } from '../../@theme/components/header/selectors/employee/employee.module';
import { EmployeeMultiSelectModule } from '../../@shared/employee/employee-multi-select/employee-multi-select.module';
import { FileUploaderModule } from '../../@shared/file-uploader-input/file-uploader-input.module';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { ColorPickerModule } from 'ngx-color-picker';
import { TasksSprintSettingsViewModule } from '../../@shared/tasks-sprint-settings-view/tasks-sprint-settings-view.module';
import { CommonModule } from '@angular/common';
import { CKEditorModule } from 'ng2-ckeditor';
@NgModule({
	imports: [
		CommonModule,
		ThemeModule,
		NbCardModule,
		FormsModule,
		NbButtonModule,
		ReactiveFormsModule,
		NbInputModule,
		NbIconModule,
		TagsColorInputModule,
		ColorPickerModule,
		NbActionsModule,
		TableComponentsModule,
		ProjectsRoutingModule,
		NbDialogModule,
		RemoveLodashModule,
		EntityWithMembersModule,
		NbDialogModule.forChild(),
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		NgSelectModule,
		OrganizationsMutationModule,
		UserFormsModule,
		ImageUploaderModule,
		NbSelectModule,
		NbDatepickerModule,
		NbToggleModule,
		EmployeeSelectorsModule,
		EmployeeMultiSelectModule,
		FileUploaderModule,
		SharedModule,
		Ng2SmartTableModule,
		NbSpinnerModule,
		TasksSprintSettingsViewModule,
		NbTabsetModule,
		CKEditorModule
	],
	declarations: [ProjectsComponent, ProjectsMutationComponent],
	entryComponents: [],
	providers: [OrganizationProjectsService, OrganizationContactService]
})
export class ProjectsModule {}
