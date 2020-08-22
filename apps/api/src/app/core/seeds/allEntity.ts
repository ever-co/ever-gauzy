import { AvailabilitySlots } from '../../availability-slots/availability-slots.entity';
import { TimeOffPolicy } from '../../time-off-policy/time-off-policy.entity';
import { TimeOffRequest } from '../../time-off-request/time-off-request.entity';
import { Proposal } from '../../proposal/proposal.entity';
import { Invite } from '../../invite/invite.entity';
import { EmployeeRecurringExpense } from '../../employee-recurring-expense';
import { OrganizationRecurringExpense } from '../../organization-recurring-expense/organization-recurring-expense.entity';
import { ExpenseCategory } from '../../expense-categories/expense-category.entity';
import { GoalTemplate } from '../../goal-template/goal-template.entity';
import { KeyResultTemplate } from '../../keyresult-template/keyresult-template.entity';
import { GoalGeneralSetting } from '../../goal-general-setting/goal-general-setting.entity';
import { GoalKPI } from '../../goal-kpi/goal-kpi.entity';
import { GoalTimeFrame } from '../../goal-time-frame/goal-time-frame.entity';
import { Goal } from '../../goal/goal.entity';
import { EquipmentSharing } from '../../equipment-sharing';
import { EstimateEmail } from '../../estimate-email/estimate-email.entity';
import { User } from '../../user/user.entity';
import { Employee } from '../../employee/employee.entity';
import { Candidate } from '../../candidate/candidate.entity';
import { Role } from '../../role/role.entity';
import { Organization } from '../../organization/organization.entity';
import { Income } from '../../income/income.entity';
import { Invoice } from '../../invoice/invoice.entity';
import { InvoiceItem } from '../../invoice-item/invoice-item.entity';
import { InvoiceEstimateHistory } from '../../invoice-estimate-history/invoice-estimate-history.entity';
import { KeyResult } from '../../keyresult/keyresult.entity';
import { KeyResultUpdate } from '../../keyresult-update/keyresult-update.entity';
import { Expense } from '../../expense/expense.entity';
import { EmployeeSetting } from '../../employee-setting';
import { OrganizationTeam } from '../../organization-team/organization-team.entity';
import { OrganizationTeamEmployee } from '../../organization-team-employee/organization-team-employee.entity';
import { OrganizationContact } from '../../organization-contact/organization-contact.entity';
import { OrganizationDocuments } from '../../organization-documents/organization-documents.entity';
import { OrganizationVendor } from '../../organization-vendors/organization-vendors.entity';
import { OrganizationDepartment } from '../../organization-department/organization-department.entity';
import { OrganizationPositions } from '../../organization-positions/organization-positions.entity';
import { OrganizationProjects } from '../../organization-projects/organization-projects.entity';
import { OrganizationAwards } from '../../organization-awards/organization-awards.entity';
import { OrganizationLanguages } from '../../organization-languages/organization-languages.entity';
import { OrganizationSprint } from '../../organization-sprint/organization-sprint.entity';
import { Task } from '../../tasks/task.entity';
import { Screenshot } from '../../timesheet/screenshot.entity';
import { Activity } from '../../timesheet/activity.entity';
import { TimeSlot } from '../../timesheet/time-slot.entity';
import { Timesheet } from '../../timesheet/timesheet.entity';
import { UserOrganization } from '../../user-organization/user-organization.entity';
import { Country } from '../../country';
import { Deal } from '../../deal/deal.entity';
import { RolePermissions } from '../../role-permissions/role-permissions.entity';
import { Tenant } from '../../tenant/tenant.entity';
import { Email } from '../../email';
import { EmailTemplate } from '../../email-template';
import { Tag } from '../../tags/tag.entity';
import { Skill } from '../../skills/skill.entity';
import { Language } from '../../language/language.entity';
import { OrganizationEmploymentType } from '../../organization-employment-type/organization-employment-type.entity';
import { Equipment } from '../../equipment/equipment.entity';
import { EmployeeLevel } from '../../organization_employeeLevel/organization-employee-level.entity';
import { ProductCategory } from '../../product-category/product-category.entity';
import { AppointmentEmployees } from '../../appointment-employees/appointment-employees.entity';
import { EmployeeAppointment } from '../../employee-appointment';
import { ProductType } from '../../product-type/product-type.entity';
import { CandidateSource } from '../../candidate-source/candidate-source.entity';
import { CandidateEducation } from '../../candidate-education/candidate-education.entity';
import { CandidateSkill } from '../../candidate-skill/candidate-skill.entity';
import { CandidateExperience } from '../../candidate-experience/candidate-experience.entity';
import { CandidateDocument } from '../../candidate-documents/candidate-documents.entity';
import { CandidateFeedback } from '../../candidate-feedbacks/candidate-feedbacks.entity';
import { HelpCenter } from '../../help-center/help-center.entity';
import { Product } from '../../product/product.entity';
import { ProductVariant } from '../../product-variant/product-variant.entity';
import { ProductVariantSettings } from '../../product-settings/product-settings.entity';
import { ProductVariantPrice } from '../../product-variant-price/product-variant-price.entity';
import { ProductOption } from '../../product-option/product-option.entity';
import { Contact } from '../../contact/contact.entity';
import { RequestApprovalTeam } from '../../request-approval-team/request-approval-team.entity';
import { RequestApproval } from '../../request-approval/request-approval.entity';
import { ApprovalPolicy } from '../../approval-policy/approval-policy.entity';
import { EquipmentSharingPolicy } from '../../equipment-sharing-policy/equipment-sharing-policy.entity';
import { RequestApprovalEmployee } from '../../request-approval-employee/request-approval-employee.entity';
import { ProductTypeTranslation } from '../../product-type/product-type-translation.entity';
import { ProductCategoryTranslation } from '../../product-category/product-category-translation.entity';
import { Payment } from '../../payment/payment.entity';
import { Pipeline } from '../../pipeline/pipeline.entity';
import { PipelineStage } from '../../pipeline-stage/pipeline-stage.entity';
import { EventType } from '../../event-types/event-type.entity';
import { CandidateInterviewers } from '../../candidate-interviewers/candidate-interviewers.entity';
import { CandidateInterview } from '../../candidate-interview/candidate-interview.entity';
import { CandidateTechnologies } from '../../candidate-technologies/candidate-technologies.entity';
import { CandidatePersonalQualities } from '../../candidate-personal-qualities/candidate-personal-qualities.entity';
import { CandidateCriterionsRating } from '../../candidate-criterions-rating/candidate-criterion-rating.entity';
import { TimeSlotMinute } from '../../timesheet/time-slot-minute.entity';
import { TimeLog } from '../../timesheet/time-log.entity';
import { HelpCenterArticle } from '../../help-center-article/help-center-article.entity';
import { HelpCenterAuthor } from '../../help-center-author/help-center-author.entity';
import { IntegrationType } from '../../integration/integration-type.entity';
import { Integration } from '../../integration/integration.entity';
import { IntegrationTenant } from '../../integration-tenant/integration-tenant.entity';
import { IntegrationEntitySetting } from '../../integration-entity-setting/integration-entity-setting.entity';
import { IntegrationEntitySettingTiedEntity } from '../../integration-entity-setting-tied-entity/integration-entity-setting-tied-entitiy.entity';
import { IntegrationSetting } from '../../integration-setting/integration-setting.entity';
import { IntegrationMap } from '../../integration-map/integration-map.entity';
import { EmployeeAward } from '../../employee-award/employee-award.entity';

export const allEntities = [
  AppointmentEmployees,
  ApprovalPolicy,
  AvailabilitySlots,
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
  Deal,
  Email,
  EmailTemplate,
  Employee,
  EmployeeAppointment,
  EmployeeAward,
  EmployeeRecurringExpense,
  EmployeeSetting,
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
  GoalTemplate,
  GoalTimeFrame,
  HelpCenter,
  HelpCenterArticle,
  HelpCenterAuthor,
  Income,
  Integration,
  IntegrationType,
  IntegrationEntitySetting,
  IntegrationEntitySettingTiedEntity,
  IntegrationMap,
  IntegrationSetting,
  IntegrationTenant,
  Invite,
  Invoice,
  InvoiceEstimateHistory,
  InvoiceItem,
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
  OrganizationProjects,
  OrganizationRecurringExpense,
  OrganizationSprint,
  OrganizationTeam,
  OrganizationTeamEmployee,
  OrganizationVendor,
  EmployeeLevel,
  Payment,
  Pipeline,
  PipelineStage,
  Product,
  ProductCategory,
  ProductOption,
  ProductVariantSettings,
  ProductType,
  ProductTypeTranslation,
  ProductCategoryTranslation,
  ProductVariant,
  ProductVariantPrice,
  Proposal,
  RequestApproval,
  RequestApprovalEmployee,
  RequestApprovalTeam,
  Role,
  RolePermissions,
  Skill,
  Tag,
  Task,
  Tenant,
  TimeOffPolicy,
  TimeOffRequest,
  Activity,
  Screenshot,
  TimeLog,
  TimeSlot,
  TimeSlotMinute,
  Timesheet,
  User,
  UserOrganization
];
