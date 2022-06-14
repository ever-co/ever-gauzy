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
import { ContactLinksComponent } from './contact-links/contact-links.component';
import { TagsOnlyComponent } from './tags-only/tags-only.component';
import { EmployeeLinksComponent } from './employee-links/employee-links.component';
import { CreateByComponent } from './create-by/create-by.component';
import { ProjectComponent } from './project/project.component';
import { EmployeesMergedTeamsComponent } from './employees-merged-teams/employees-merged-teams.component';
import { CreatedAtComponent } from './created-at/created-at.component';
import { ContactWithTagsComponent } from './contact-with-tags/contact-with-tags.component';
import { OrganizationWithTagsComponent } from './organization-with-tags/organization-with-tags.component';
import { EmailComponent } from './email/email.component';
import { RoleComponent } from './role/role.component';
import { ExternalLinkComponent } from './external-link/external-link.component';

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
		DocumentDateTableComponent,
		TagsOnlyComponent,
		ContactLinksComponent,
		EmployeeLinksComponent,
		CreateByComponent,
		ProjectComponent,
		EmployeesMergedTeamsComponent,
		CreatedAtComponent,
		ContactWithTagsComponent,
		OrganizationWithTagsComponent,
		EmailComponent,
		RoleComponent,
		ExternalLinkComponent
	],
	exports: [
		NotesWithTagsComponent,
		PictureNameTagsComponent,
		EmployeeWithLinksComponent,
		StatusViewComponent,
		ValueWithUnitComponent,
		ContactLinksComponent,
		EmployeeLinksComponent,
		ProjectComponent,
		RoleComponent,
		EmailComponent,
		ExternalLinkComponent
	],
	providers: []
})
export class TableComponentsModule {}
