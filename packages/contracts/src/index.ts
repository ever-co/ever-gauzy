/**
 * Public API Surface of @gauzy/contracts
 */
export * from './lib/accounting-template.model';
/** App Setting Model */
export * from './lib/activity-log.model';
export * from './lib/activity-watch.model';
export * from './lib/api-call-log.model';
export * from './lib/app.model';
export * from './lib/appointment-employees.model';
export * from './lib/approval-policy.model';
export * from './lib/availability-slots.model';
export * from './lib/auth.model';
export * from './lib/candidate-criterions-rating.model';
export * from './lib/candidate-document.model';
export * from './lib/candidate-education.model';
export * from './lib/candidate-experience.model';
export * from './lib/candidate-feedback.model';
export * from './lib/candidate-interview.model';
export * from './lib/candidate-interviewers.model';
export * from './lib/candidate-personal-qualities.model';
export * from './lib/candidate-skill.model';
export * from './lib/candidate-source.model';
export * from './lib/candidate-technologies.model';
export * from './lib/candidate.model';
export * from './lib/changelog.model';
export * from './lib/chart.model';
export * from './lib/comment.model';
export * from './lib/contact.model';
export * from './lib/core.model';
export * from './lib/country.model';
export * from './lib/currency.model';
export * from './lib/custom-smtp.model';
export * from './lib/daily-plan.model';
export * from './lib/date-picker.model';
export * from './lib/dashboard.model';
export * from './lib/dashboard-widget.model';
export * from './lib/deal.model';
export * from './lib/email-reset.model';
export * from './lib/email-template.model';
export * from './lib/email.model';
export * from './lib/employee-appointment.model';
export * from './lib/employee-availability.model';
export * from './lib/employee-award.model';
export * from './lib/employee-job.model';
export * from './lib/employee-phone.model';
export * from './lib/employee-proposal-template.model';
export * from './lib/employee-recurring-expense.model';
export * from './lib/employee-settings.model';
export * from './lib/employee-statistics.model';
export * from './lib/employee.model';
export * from './lib/entity-with-members.model';
export * from './lib/equipment-sharing-policy.model';
export * from './lib/equipment-sharing.model';
export * from './lib/equipment.model';
export * from './lib/estimate-email.model';
export * from './lib/event-type.model';
export * from './lib/expense-category.model';
export * from './lib/expense.model';
export * from './lib/favorite.model';
export * from './lib/feature.model';
export * from './lib/file-provider';
export * from './lib/geo-location.model';
export * from './lib/github.model';
export * from './lib/goal-settings.model';
export * from './lib/goals.model';
export * from './lib/help-center-article.model';
export * from './lib/help-center.model';
export * from './lib/http-status.enum';
export * from './lib/hubstaff.model';
export * from './lib/image-asset.model';
export * from './lib/import-export.model';
export * from './lib/income.model';
export * from './lib/integration-setting.model';
export * from './lib/integration.model';
export * from './lib/invite.model';
export * from './lib/invoice-estimate-history.model';
export * from './lib/invoice-item.model';
export * from './lib/invoice.model';
export * from './lib/issue-type.model';
export * from './lib/job-matching.model';
export * from './lib/job-search-category.model';
export * from './lib/job-search-occupation.model';
export * from './lib/language.model';
export * from './lib/mention.model';
export * from './lib/organization-award.model';
export * from './lib/organization-contact.model';
export * from './lib/organization-department.model';
export * from './lib/organization-document.model';
export * from './lib/organization-employment-type.model';
export * from './lib/organization-expense-category.model';
export * from './lib/organization-language.model';
export * from './lib/organization-positions.model';
export * from './lib/organization-project-module.model';
export * from './lib/organization-projects.model';
export * from './lib/organization-recurring-expense.model';
export * from './lib/organization-sprint.model';
export * from './lib/organization-task-setting.model';
export * from './lib/organization-team-employee-model';
export * from './lib/organization-team-join-request.model';
export * from './lib/organization-team.model';
export * from './lib/organization-vendors.model';
export * from './lib/organization.model';
export * from './lib/password-reset.model';
export * from './lib/payment.model';
export * from './lib/pipeline-stage.model';
export * from './lib/pipeline.model';
export * from './lib/product.model';
export * from './lib/project.model';
export * from './lib/proposal.model';
export * from './lib/reaction.model';
export * from './lib/recurring-expense.model';
export * from './lib/report.model';
export * from './lib/request-approval-employee.model';
export * from './lib/request-approval-team.model';
export * from './lib/request-approval.model';
export * from './lib/resource-link.model';
export * from './lib/role-permission.model';
export * from './lib/role.model';
export * from './lib/screening-task.model';
export * from './lib/screenshot.model';
export * from './lib/seed.model';
export * from './lib/shared-types';
export * from './lib/skill-entity.model';
export * from './lib/sms.model';
export * from './lib/social-account.model';
export * from './lib/subscription.model';
export * from './lib/tag.model';
export * from './lib/task-estimation.model';
export * from './lib/task-linked-issue.model';
export * from './lib/task-priority.model';
export * from './lib/task-related-issue-type.model';
export * from './lib/task-size.model';
export * from './lib/task-status.model';
export * from './lib/task-version.model';
export * from './lib/task-view.model';
export * from './lib/task.model';
export * from './lib/tenant-api-key.model';
export * from './lib/tenant.model';
export * from './lib/time-off.model';
export * from './lib/timesheet-statistics.model';
export * from './lib/timesheet.model';
export * from './lib/translation.model';
export * from './lib/tree-node.model';
export * from './lib/upwork.model';
export * from './lib/user-organization.model';
export * from './lib/user.model';
export * from './lib/wakatime.model';

export {
	ActorTypeEnum,
	BaseEntityEnum,
	IBaseEntityModel as BaseEntityModel,
	IBasePerTenantAndOrganizationEntityModel,
	IBasePerTenantEntityModel,
	IBaseRelationsEntityModel,
	IBaseSoftDeleteEntityModel,
	ID,
	JsonData
} from './lib/base-entity.model';

export * from './lib/proxy.model';
