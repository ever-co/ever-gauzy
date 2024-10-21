import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbTooltipModule, NbBadgeModule, NbToggleModule, NbButtonModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { ComponentsModule } from '../components/components.module';
import { PipesModule } from '../pipes/pipes.module';
import {
	EmployeeLinkEditorComponent,
	JobSearchAvailabilityEditorComponent,
	NonEditableNumberEditorComponent,
	NumberEditorComponent
} from './editors';
import { AllowScreenshotCaptureComponent } from './allow-screenshot-capture/allow-screenshot-capture.component';
import { AssignedToComponent } from './assigned-to/assigned-to.component';
import { ClickableLinkComponent } from './clickable-link/clickable-link.component';
import { CompanyLogoComponent } from './company-logo/company-logo.component';
import { ContactLinksComponent } from './contact-links/contact-links.component';
import { ContactWithTagsComponent } from './contact-with-tags/contact-with-tags.component';
import { CreateByComponent } from './create-by/create-by.component';
import { CreatedAtComponent } from './created-at/created-at.component';
import { DateViewComponent } from './date-view/date-view.component';
import { DocumentDateTableComponent } from './document-date/document-date.component';
import { DocumentUrlTableComponent } from './document-url/document-url.component';
import { EmailComponent } from './email/email.component';
import { EmployeeLinksComponent } from './employee-links/employee-links.component';
import { EmployeeWithLinksComponent } from './employee-with-links/employee-with-links.component';
import { EmployeesMergedTeamsComponent } from './employees-merged-teams/employees-merged-teams.component';
import { ExternalLinkComponent } from './external-link/external-link.component';
import { GithubIssueTitleDescriptionComponent } from './github/issue-title-description/issue-title-description.component';
import { GithubRepositoryComponent } from './github/repository/repository.component';
import { ResyncButtonComponent } from './github/resync-button/resync-button.component';
import { IncomeExpenseAmountComponent } from './income-amount/income-amount.component';
import { InvoiceTotalValueComponent } from './invoice-total-value/invoice-total-value.component';
import { NotesWithTagsComponent } from './notes-with-tags/notes-with-tags.component';
import { OrganizationWithTagsComponent } from './organization-with-tags/organization-with-tags.component';
import { PhoneUrlComponent } from './phone-url/phone-url.component';
import { PictureNameTagsComponent } from './picture-name-tags/picture-name-tags.component';
import { ProjectOrganizationEmployeesComponent } from './project-organization-employees/project-organization-employees.component';
import { ProjectOrganizationGridDetailsComponent } from './project-organization-grid-details/project-organization-grid-details.component';
import { ProjectOrganizationGridComponent } from './project-organization-grid/project-organization-grid.component';
import { ProjectOrganizationComponent } from './project-organization/project-organization.component';
import { ProjectComponent } from './project/project.component';
import { RoleComponent } from './role/role.component';
import { StatusViewComponent } from './status-view/status-view.component';
import { TagsOnlyComponent } from './tags-only/tags-only.component';
import { TaskEstimateComponent } from './task-estimate/task-estimate.component';
import { TaskTeamsComponent } from './task-teams/task-teams.component';
import { ToggleSwitcherComponent } from './toggle-switcher/toggle-switcher.component';
import { TrustHtmlLinkComponent } from './trust-html/trust-html.component';
import { ValueWithUnitComponent } from './value-with-units/value-with-units.component';
import { VisibilityComponent } from './visibility/visibility.component';
import { DirectivesModule } from '../directives/directives.module';
import { TaskBadgeViewComponentModule } from '../tasks/task-badge-view/task-badge-view.module';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		NbBadgeModule,
		NbButtonModule,
		NbIconModule,
		NbToggleModule,
		NbTooltipModule,
		TranslateModule.forChild(),
		DirectivesModule,
		PipesModule,
		ComponentsModule,
		TaskBadgeViewComponentModule
	],
	declarations: [
		AllowScreenshotCaptureComponent,
		AssignedToComponent,
		ClickableLinkComponent,
		CompanyLogoComponent,
		ContactLinksComponent,
		ContactWithTagsComponent,
		CreateByComponent,
		CreatedAtComponent,
		DateViewComponent,
		DocumentDateTableComponent,
		DocumentUrlTableComponent,
		EmailComponent,
		EmployeeLinksComponent,
		EmployeeWithLinksComponent,
		EmployeesMergedTeamsComponent,
		ExternalLinkComponent,
		GithubIssueTitleDescriptionComponent,
		GithubRepositoryComponent,
		IncomeExpenseAmountComponent,
		InvoiceTotalValueComponent,
		NotesWithTagsComponent,
		NumberEditorComponent,
		EmployeeLinkEditorComponent,
		OrganizationWithTagsComponent,
		PhoneUrlComponent,
		PictureNameTagsComponent,
		ProjectComponent,
		ProjectOrganizationComponent,
		ProjectOrganizationEmployeesComponent,
		ProjectOrganizationGridComponent,
		ProjectOrganizationGridDetailsComponent,
		ResyncButtonComponent,
		RoleComponent,
		StatusViewComponent,
		TagsOnlyComponent,
		TaskEstimateComponent,
		TaskTeamsComponent,
		ToggleSwitcherComponent,
		TrustHtmlLinkComponent,
		ValueWithUnitComponent,
		VisibilityComponent,
		NonEditableNumberEditorComponent,
		JobSearchAvailabilityEditorComponent
	],
	exports: [
		AllowScreenshotCaptureComponent,
		AssignedToComponent,
		ClickableLinkComponent,
		CompanyLogoComponent,
		ContactLinksComponent,
		ContactWithTagsComponent,
		CreateByComponent,
		CreatedAtComponent,
		DateViewComponent,
		DocumentDateTableComponent,
		DocumentUrlTableComponent,
		EmailComponent,
		EmployeeLinksComponent,
		EmployeeWithLinksComponent,
		EmployeesMergedTeamsComponent,
		ExternalLinkComponent,
		GithubIssueTitleDescriptionComponent,
		GithubRepositoryComponent,
		IncomeExpenseAmountComponent,
		InvoiceTotalValueComponent,
		NotesWithTagsComponent,
		NumberEditorComponent,
		JobSearchAvailabilityEditorComponent,
		NonEditableNumberEditorComponent,
		OrganizationWithTagsComponent,
		PhoneUrlComponent,
		PictureNameTagsComponent,
		ProjectComponent,
		ProjectOrganizationComponent,
		ProjectOrganizationEmployeesComponent,
		ProjectOrganizationGridComponent,
		ProjectOrganizationGridDetailsComponent,
		ResyncButtonComponent,
		RoleComponent,
		StatusViewComponent,
		TagsOnlyComponent,
		TaskEstimateComponent,
		TaskTeamsComponent,
		ToggleSwitcherComponent,
		TrustHtmlLinkComponent,
		ValueWithUnitComponent,
		VisibilityComponent
	],
	providers: []
})
export class TableComponentsModule {}
