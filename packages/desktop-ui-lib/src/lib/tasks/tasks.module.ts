import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TasksComponent } from './tasks.component';
import {
	NbLayoutModule,
	NbSidebarModule,
	NbMenuModule,
	NbCardModule,
	NbIconModule,
	NbListModule,
	NbSelectModule,
	NbToggleModule,
	NbInputModule,
	NbButtonModule,
	NbAlertModule,
	NbProgressBarModule,
	NbTabsetModule,
	NbToastrService,
	NbAccordionModule,
	NbDatepickerModule,
	NbBadgeModule
} from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { TimeTrackerService } from '../time-tracker/time-tracker.service';
import { DesktopDirectiveModule } from '../directives/desktop-directive.module';
import { TranslateModule } from '@ngx-translate/core';
import { CKEditorModule } from 'ckeditor4-angular';
import { TaskRenderModule } from '../time-tracker/task-render';
import { TagService } from '../services';
import { SelectModule } from "../shared/components/ui/select/select.module";

@NgModule({
	declarations: [TasksComponent],
	imports: [
    CommonModule,
    NbLayoutModule,
    NbSidebarModule,
    NbMenuModule.forRoot(),
    NbCardModule,
    NbIconModule,
    NbListModule,
    NbSelectModule,
    FormsModule,
    NbToggleModule,
    NbInputModule,
    NbButtonModule,
    NbAlertModule,
    NbProgressBarModule,
    NbTabsetModule,
    NbAccordionModule,
    NbDatepickerModule,
    NgSelectModule,
    ReactiveFormsModule,
    NbBadgeModule,
    DesktopDirectiveModule,
    TranslateModule,
    CKEditorModule,
    TaskRenderModule,
    SelectModule
],
	providers: [NbToastrService, TimeTrackerService, TagService],
	exports: [TasksComponent]
})
export class TasksModule {}
