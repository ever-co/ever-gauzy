import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbDatepickerModule,
	NbIconModule,
	NbInputModule,
	NbListModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbToggleModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { CKEditorModule } from 'ckeditor4-angular';
import { ColorPickerModule } from 'ngx-color-picker';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../shared.module';
import { CurrencyModule } from '../../modules/currency/currency.module';
import { EmployeeMultiSelectModule } from '../../employee/employee-multi-select/employee-multi-select.module';
import { ImageUploaderModule } from '../../image-uploader/image-uploader.module';
import { TagsColorInputModule } from '../../tags/tags-color-input/tags-color-input.module';
import { TeamSelectModule } from '../../selectors/team/team.module';
import { ProjectModuleTableModule } from '../../project-module/project-module-table/project-module-table.module';
import { ProjectMutationComponent } from './project-mutation.component';
import { RepositorySelectorModule } from '../../integrations/github/repository-selector/repository-selector.module';
import { SmartDataViewLayoutModule } from '../../smart-data-layout';

@NgModule({
	declarations: [ProjectMutationComponent],
	exports: [ProjectMutationComponent],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbCardModule,
		NbDatepickerModule,
		NbInputModule,
		NbListModule,
		NbSelectModule,
		NbSpinnerModule,
		NbTabsetModule,
		NbToggleModule,
		NbIconModule,
		NgSelectModule,
		CKEditorModule,
		ColorPickerModule,
		SharedModule,
		TranslateModule.forChild(),
		CurrencyModule,
		EmployeeMultiSelectModule,
		ImageUploaderModule,
		TagsColorInputModule,
		TeamSelectModule,
		RepositorySelectorModule,
		SmartDataViewLayoutModule,
		ProjectModuleTableModule
	]
})
export class ProjectMutationModule {}
