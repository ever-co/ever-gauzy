import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbTooltipModule, NbBadgeModule, NbToggleModule, NbButtonModule } from '@nebular/theme';
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
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
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
import { CompanyLogoComponent } from './company-logo/company-logo.component';
import { ProjectOrganizationComponent } from './project-organization/project-organization.component';
import { VisibilityComponent } from './visibility/visibility.component';
import { ProjectOrganizationGridComponent } from './project-organization-grid/project-organization-grid.component';
import { ProjectOrganizationGridDetailsComponent } from './project-organization-grid-details/project-organization-grid-details.component';
import { ProjectOrganizationEmployeesComponent } from './project-organization-employees/project-organization-employees.component';
import { PhoneUrlComponent } from './phone-url/phone-url.component';
import { AllowScreenshotCaptureComponent } from './allow-screenshot-capture/allow-screenshot-capture.component';
import { NumberEditorComponent } from './editors/number-editor.component';
import { ClickableLinkComponent } from './clickable-link/clickable-link.component';
import { TrustHtmlLinkComponent } from './trust-html/trust-html.component';
import { ToggleSwitchComponent } from './toggle-switch/toggle-switch.component';
import { GithubRepositoryComponent } from './github/repository/repository.component';
import { GithubIssueTitleDescriptionComponent } from './github/issue-title-description/issue-title-description.component';
import { ResyncButtonComponent } from './github/resync-button/resync-button.component';
import { StatusBadgeModule } from '../status-badge';

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
		SharedModule,
		StatusBadgeModule
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
		ExternalLinkComponent,
		CompanyLogoComponent,
		ProjectOrganizationComponent,
		VisibilityComponent,
		ProjectOrganizationGridComponent,
		ProjectOrganizationGridDetailsComponent,
		ProjectOrganizationEmployeesComponent,
		PhoneUrlComponent,
		AllowScreenshotCaptureComponent,
		// smart table field editor
		NumberEditorComponent,
		ClickableLinkComponent,
		TrustHtmlLinkComponent,
		ToggleSwitchComponent,
		GithubRepositoryComponent,
		GithubIssueTitleDescriptionComponent,
		ResyncButtonComponent
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
		ExternalLinkComponent,
		TagsOnlyComponent,
		CompanyLogoComponent,
		ProjectOrganizationComponent,
		PhoneUrlComponent,
		CreateByComponent,
		CreatedAtComponent,
		DateViewComponent,
		ClickableLinkComponent,
		TrustHtmlLinkComponent,
		GithubRepositoryComponent,
		ToggleSwitchComponent,
		GithubIssueTitleDescriptionComponent,
		ResyncButtonComponent
	],
	providers: []
})
export class TableComponentsModule {}
