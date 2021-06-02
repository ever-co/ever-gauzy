import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NbIconModule, NbTooltipModule, NbBadgeModule } from '@nebular/theme';
import { DateViewComponent } from './date-view/date-view.component';
import { IncomeExpenseAmountComponent } from './income-amount/income-amount.component';
import { NotesWithTagsComponent } from './notes-with-tags/notes-with-tags.component';
import { PictureNameTagsComponent } from './picture-name-tags/picture-name-tags.component';
import { TaskEstimateComponent } from './task-estimate/task-estimate.component';
import { EmployeeWithLinksComponent } from './employee-with-links/employee-with-links.component';
import { TaskTeamsComponent } from './task-teams/task-teams.component';
import { AssignedToComponent } from './assigned-to/assigned-to.component';
import { StatusViewComponent } from './status-view/status-view.component';
import { ValueWithUnitComponent } from './value-with-units/value-with-units.component';
import { DocumentUrlTableComponent } from './document-url/document-url.component';
import { DocumentDateTableComponent } from './document-date/document-date.component';
import { TranslateModule } from '../translate/translate.module';
import { SharedModule } from '../shared.module';

@NgModule({
	imports: [
		CommonModule,
		NbIconModule,
		NbTooltipModule,
		NbBadgeModule,
		TranslateModule,
		SharedModule
	],
	declarations: [
		DateViewComponent,
		IncomeExpenseAmountComponent,
		NotesWithTagsComponent,
		PictureNameTagsComponent,
		TaskEstimateComponent,
		EmployeeWithLinksComponent,
		TaskTeamsComponent,
		AssignedToComponent,
		StatusViewComponent,
		ValueWithUnitComponent,
		DocumentUrlTableComponent,
		DocumentDateTableComponent
	],
	exports: [
		NotesWithTagsComponent,
		PictureNameTagsComponent,
		EmployeeWithLinksComponent,
		StatusViewComponent,
		ValueWithUnitComponent
	],
	providers: []
})
export class TableComponentsModule {}
