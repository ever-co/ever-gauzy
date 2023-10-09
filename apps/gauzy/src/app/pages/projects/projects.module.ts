import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
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
	NbTabsetModule,
	NbTooltipModule
} from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ProjectsRoutingModule } from './projects-routing.module';
import { TagsColorInputModule } from '../../@shared/tags/tags-color-input/tags-color-input.module';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { OrganizationProjectsService } from '../../@core/services/organization-projects.service';
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
import { CKEditorModule } from 'ckeditor4-angular';
import { CurrencyModule } from '../../@shared/currency/currency.module';
import { TranslateModule } from '../../@shared/translate/translate.module';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';
import { GauzyButtonActionModule } from '../../@shared/gauzy-button-action/gauzy-button-action.module';
import { PaginationModule } from '../../@shared/pagination/pagination.module';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { TeamSelectModule } from '../../@shared/team-select/team-select.module';
import { ProjectLayoutComponent } from './layout/layout.component';
import { ProjectCreateMutationComponent } from './components/project-create/create.component';
import { ProjectEditMutationComponent } from './components/project-edit/edit.component';
import { ProjectMutationModule } from '../../@shared/project/project-mutation/project-mutation.module';
import { ProjectListComponent } from './components/project-list/list.component';

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
		TranslateModule,
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
		CKEditorModule,
		CurrencyModule,
		HeaderTitleModule,
		GauzyButtonActionModule,
		NbTooltipModule,
		PaginationModule,
		TeamSelectModule,
		CardGridModule,
		ProjectMutationModule
	],
	declarations: [
		ProjectLayoutComponent,
		ProjectListComponent,
		ProjectCreateMutationComponent,
		ProjectEditMutationComponent
	],
	providers: [OrganizationProjectsService, OrganizationContactService]
})
export class ProjectsModule { }
