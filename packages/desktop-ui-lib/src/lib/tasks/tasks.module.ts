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
		TranslateModule
	],
	providers: [
		NbToastrService,
		TimeTrackerService
	],
	exports: [TasksComponent]
})
export class TasksModule {}
