import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { ImportAllController } from './import-all.controller';
import { ImportAllService } from './import-all.service';
import { MulterModule } from '@nestjs/platform-express';
import { Country } from '../../country/country.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tag } from '../../tags/tag.entity';
import { User } from '../../user/user.entity';
import { UserOrganization } from '../../user-organization/user-organization.entity';
import { Activity } from '../../timesheet/activity.entity';
import { ApprovalPolicy } from '../../approval-policy/approval-policy.entity';
import { AvailabilitySlot } from '../../availability-slots/availability-slots.entity';
import { Candidate } from '../../candidate/candidate.entity';
import { CandidateDocument } from '../../candidate-documents/candidate-documents.entity';
import { CandidateEducation } from '../../candidate-education/candidate-education.entity';
import { CandidateExperience } from '../../candidate-experience/candidate-experience.entity';
import { CandidateFeedback } from '../../candidate-feedbacks/candidate-feedbacks.entity';
import { CandidateInterview } from '../../candidate-interview/candidate-interview.entity';
import { CandidateInterviewers } from '../../candidate-interviewers/candidate-interviewers.entity';
import { CandidatePersonalQualities } from '../../candidate-personal-qualities/candidate-personal-qualities.entity';
import { CandidateSkill } from '../../candidate-skill/candidate-skill.entity';
import { CandidateSource } from '../../candidate-source/candidate-source.entity';
import { CandidateTechnologies } from '../../candidate-technologies/candidate-technologies.entity';
import { Deal } from '../../deal/deal.entity';
import { EmailTemplate } from '../../email-template';
import { Email } from '../../email';
import { Employee } from '../../employee/employee.entity';
import { Equipment } from '../../equipment/equipment.entity';
import { ExpenseCategory } from '../../expense-categories/expense-category.entity';
import { GoalKPI } from '../../goal-kpi/goal-kpi.entity';
import { Expense } from '../../expense/expense.entity';
import { GoalTimeFrame } from '../../goal-time-frame/goal-time-frame.entity';
import { Goal } from '../../goal/goal.entity';
import { IntegrationTenant } from '../../integration-tenant/integration-tenant.entity';
import { InvoiceItem } from '../../invoice-item/invoice-item.entity';
import { Invoice } from '../../invoice/invoice.entity';
import { KeyResult } from '../../keyresult/keyresult.entity';
import { Language } from '../../language/language.entity';
import { OrganizationContact } from '../../organization-contact/organization-contact.entity';
import { OrganizationDepartment } from '../../organization-department/organization-department.entity';
import { OrganizationDocuments } from '../../organization-documents/organization-documents.entity';
import { OrganizationEmploymentType } from '../../organization-employment-type/organization-employment-type.entity';
import { OrganizationPositions } from '../../organization-positions/organization-positions.entity';
import { OrganizationProject } from '../../organization-projects/organization-projects.entity';
import { OrganizationTeam } from '../../organization-team/organization-team.entity';
import { OrganizationTeamEmployee } from '../../organization-team-employee/organization-team-employee.entity';
import { OrganizationVendor } from '../../organization-vendors/organization-vendors.entity';
import { Organization } from '../../organization/organization.entity';
import { Pipeline } from '../../pipeline/pipeline.entity';
import { ProductCategory } from '../../product-category/product-category.entity';
import { ProductOption } from '../../product-option/product-option.entity';
import { ProductVariantSettings } from '../../product-settings/product-settings.entity';
import { ProductType } from '../../product-type/product-type.entity';
import { ProductVariantPrice } from '../../product-variant-price/product-variant-price.entity';
import { ProductVariant } from '../../product-variant/product-variant.entity';
import { Product } from '../../product/product.entity';
import { RequestApproval } from '../../request-approval/request-approval.entity';
import { RolePermissions } from '../../role-permissions/role-permissions.entity';
import { Role } from '../../role/role.entity';
import { Skill } from '../../skills/skill.entity';
import { Tenant } from '../../tenant/tenant.entity';
import { TimeLog } from '../../timesheet/time-log.entity';
import { TimeSlot } from '../../timesheet/time-slot.entity';
import { TimeOffPolicy } from '../../time-off-policy/time-off-policy.entity';
import { Timesheet } from '../../timesheet/timesheet.entity';
import { TimeOffRequest } from '../../time-off-request/time-off-request.entity';
import { Income } from '../../income/income.entity';
import { Integration } from '../../integration/integration.entity';
import { Invite } from '../../invite/invite.entity';
import { AppointmentEmployee } from '../../appointment-employees/appointment-employees.entity';
import { CandidateCriterionsRating } from '../../candidate-criterions-rating/candidate-criterion-rating.entity';
import { Contact } from '../../contact/contact.entity';
import { EmployeeAppointment } from '../../employee-appointment';
import { EmployeeLevel } from '../../organization_employee-level/organization-employee-level.entity';
import { EmployeeRecurringExpense } from '../../employee-recurring-expense/employee-recurring-expense.entity';
import { EmployeeSetting } from '../../employee-setting/employee-setting.entity';
import { EquipmentSharing } from '../../equipment-sharing';
import { IntegrationSetting } from '../../integration-setting/integration-setting.entity';
import { IntegrationMap } from '../../integration-map/integration-map.entity';
import { IntegrationEntitySettingTiedEntity } from '../../integration-entity-setting-tied-entity/integration-entity-setting-tied-entity.entity';
import { IntegrationEntitySetting } from '../../integration-entity-setting/integration-entity-setting.entity';
import { KeyResultUpdate } from '../../keyresult-update/keyresult-update.entity';
import { OrganizationAwards } from '../../organization-awards/organization-awards.entity';
import { OrganizationLanguages } from '../../organization-languages/organization-languages.entity';
import { OrganizationRecurringExpense } from '../../organization-recurring-expense/organization-recurring-expense.entity';
import { OrganizationSprint } from '../../organization-sprint/organization-sprint.entity';
import { Payment } from '../../payment/payment.entity';
import { Proposal } from '../../proposal/proposal.entity';
import { RequestApprovalEmployee } from '../../request-approval-employee/request-approval-employee.entity';
import { RequestApprovalTeam } from '../../request-approval-team/request-approval-team.entity';
import { Screenshot } from '../../timesheet/screenshot.entity';
import { Task } from '../../tasks/task.entity';
import { TimeSlotMinute } from '../../timesheet/time-slot-minute.entity';
import { EquipmentSharingPolicy } from '../../equipment-sharing-policy/equipment-sharing-policy.entity';
import { EstimateEmail } from '../../estimate-email/estimate-email.entity';
import { EventType } from '../../event-types/event-type.entity';
import { GoalGeneralSetting } from '../../goal-general-setting/goal-general-setting.entity';
import { PipelineStage } from '../../pipeline-stage/pipeline-stage.entity';
import { CustomSmtp } from '../../custom-smtp/custom-smtp.entity';
import { Currency } from '../../currency';
import { EmployeeAward } from '../../employee-award/employee-award.entity';
import { JobSearchOccupation } from '../../employee-job-preset/job-search-occupation/job-search-occupation.entity';
import { JobSearchCategory } from '../../employee-job-preset/job-search-category/job-search-category.entity';
import { JobPresetUpworkJobSearchCriterion } from '../../employee-job-preset/job-preset-upwork-job-search-criterion.entity';
import { EmployeeUpworkJobsSearchCriterion } from '../../employee-job-preset/employee-upwork-jobs-search-criterion.entity';
import { EmployeeProposalTemplate } from '../../employee-proposal-template/employee-proposal-template.entity';
import { GoalKPITemplate } from '../../goal-kpi-template/goal-kpi-template.entity';
import { GoalTemplate } from '../../goal-template/goal-template.entity';
import { InvoiceEstimateHistory } from '../../invoice-estimate-history/invoice-estimate-history.entity';
import { KeyResultTemplate } from '../../keyresult-template/keyresult-template.entity';
import { Report } from '../../reports/report.entity';
import { ReportCategory } from '../../reports/report-category.entity';
import { ReportOrganization } from '../../reports/report-organization.entity';
import { JobPreset } from '../../employee-job-preset/job-preset.entity';

@Module({
	imports: [
		RouterModule.forRoutes([{ path: '/import', module: ImportAllModule }]),
		CqrsModule,
		MulterModule.register({
			dest: './import'
		}),
		TypeOrmModule.forFeature([
			Activity,
			AppointmentEmployee,
			ApprovalPolicy,
			AvailabilitySlot,

			Candidate,
			CandidateCriterionsRating,
			CandidateDocument,
			CandidateEducation,
			CandidateExperience,
			CandidateFeedback,
			CandidateInterview,
			CandidateInterviewers,
			CandidatePersonalQualities,
			CandidateSkill,
			CandidateSource,
			CandidateTechnologies,
			Contact,
			Country,
			Currency,
			CustomSmtp,

			Deal,

			Email,
			EmailTemplate,
			Employee,
			EmployeeAppointment,
			EmployeeAward,
			EmployeeLevel,
			EmployeeProposalTemplate,
			EmployeeRecurringExpense,
			EmployeeSetting,
			EmployeeUpworkJobsSearchCriterion,
			Equipment,
			EquipmentSharing,
			EquipmentSharingPolicy,
			EstimateEmail,
			EventType,
			Expense,
			ExpenseCategory,

			Goal,
			GoalGeneralSetting,
			GoalKPI,
			GoalKPITemplate,
			GoalTemplate,
			GoalTimeFrame,

			Income,
			Integration,
			IntegrationEntitySetting,
			IntegrationEntitySettingTiedEntity,
			IntegrationMap,
			IntegrationSetting,
			IntegrationTenant,
			Invite,
			Invoice,
			InvoiceEstimateHistory,
			InvoiceItem,

			JobPreset,
			JobSearchOccupation,
			JobSearchCategory,
			JobPresetUpworkJobSearchCriterion,

			KeyResult,
			KeyResultTemplate,
			KeyResultUpdate,

			Language,

			Organization,
			OrganizationAwards,
			OrganizationContact,
			OrganizationDepartment,
			OrganizationDocuments,
			OrganizationEmploymentType,
			OrganizationLanguages,
			OrganizationPositions,
			OrganizationProject,
			OrganizationRecurringExpense,
			OrganizationSprint,
			OrganizationTeam,
			OrganizationTeamEmployee,
			OrganizationVendor,

			Payment,
			Pipeline,
			PipelineStage,
			Product,
			ProductCategory,
			ProductOption,
			ProductVariantSettings,
			ProductType,
			ProductVariant,
			ProductVariantPrice,
			Proposal,

			Report,
			ReportCategory,
			ReportOrganization,
			RequestApproval,
			RequestApprovalEmployee,
			RequestApprovalTeam,
			Role,
			RolePermissions,

			Screenshot,
			Skill,

			Tag,
			Task,
			Tenant,
			TimeOffPolicy,
			TimeOffRequest,
			Timesheet,
			TimeLog,
			TimeSlot,
			TimeSlotMinute,

			User,
			UserOrganization
		])
	],
	controllers: [ImportAllController],
	providers: [ImportAllService],
	exports: [ImportAllService]
})
export class ImportAllModule {}
