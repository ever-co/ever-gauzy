import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbDatepickerModule,
	NbIconModule,
	NbInputModule,
	NbListModule,
	NbSelectModule,
	NbSpinnerModule,
	NbToggleModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { ColorPickerComponent, ColorPickerDirective } from 'ngx-color-picker';
import { TranslatePipe } from '@ngx-translate/core';
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
import { RichTextEditorModule } from '../../rich-text-editor/rich-text-editor.module';

@NgModule({
	declarations: [ProjectMutationComponent],
	exports: [ProjectMutationComponent],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
			NbDatepickerModule,
		NbInputModule,
		NbListModule,
		NbSelectModule,
		NbSpinnerModule,
			NbToggleModule,
		NbIconModule,
		NgSelectModule,
		RichTextEditorModule,
		ColorPickerComponent,
		ColorPickerDirective,
		SharedModule,
		TranslatePipe,
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
