import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskComponent } from './components/team-task/team-task.component';
import { TasksRoutingModule } from './team-tasks-routing.module';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import {
	NbSpinnerModule,
	NbCardModule,
	NbIconModule,
	NbButtonModule,
	NbDialogModule,
	NbInputModule,
	NbSelectModule,
	NbBadgeModule,
	NbDatepickerModule,
	NbRadioModule
} from '@nebular/theme';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { ThemeModule } from '../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TaskDialogComponent } from './components/team-task-dialog/team-task-dialog.component';
import { NgSelectModule } from '@ng-select/ng-select';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { TagsColorInputModule } from '../../@shared/tags/tags-color-input/tags-color-input.module';
import { EmployeeMultiSelectModule } from '../../@shared/employee/employee-multi-select/employee-multi-select.module';
export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	declarations: [TaskComponent, TaskDialogComponent],
	imports: [
		NbBadgeModule,
		TableComponentsModule,
		TagsColorInputModule,
		CommonModule,
		ThemeModule,
		NbCardModule,
		NbButtonModule,
		NgSelectModule,
		NbRadioModule,
		NbIconModule,
		FormsModule,
		ReactiveFormsModule,
		TasksRoutingModule,
		NbInputModule,
		NbSelectModule,
		NbDialogModule.forChild(),
		Ng2SmartTableModule,
		UserFormsModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		NbSpinnerModule,
		NbDatepickerModule,
		EmployeeMultiSelectModule
	],
	entryComponents: [TaskDialogComponent]
})
export class TeamTasksModule {}
