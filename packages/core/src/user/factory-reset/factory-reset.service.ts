// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { ConfigService } from '@gauzy/config';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RequestContext } from 'core';
import { Repository, In } from 'typeorm';
import { filter, map, some } from 'underscore';
import {
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
    CandidateSkill,
    CandidateSource,
    CandidateTechnologies,
    Contact,
    Deal,
    EmailHistory,
    Employee,
    EmployeeAppointment,
    EmployeeAward,
    EmployeeLevel,
    EmployeeProposalTemplate,
    EmployeeRecurringExpense,
    EmployeeSetting,
    Equipment,
    EquipmentSharing,
    EstimateEmail,
    EventType,
    Expense,
    ExpenseCategory,
    FeatureOrganization,
    Goal,
    GoalKPI,
    GoalKPITemplate,
    GoalTemplate,
    GoalTimeFrame,
    Income,
    IntegrationEntitySetting,
    IntegrationEntitySettingTied,
    IntegrationMap,
    IntegrationSetting,
    IntegrationTenant,
    Invite,
    Invoice,
    InvoiceEstimateHistory,
    InvoiceItem,
    JobPreset,
    JobSearchCategory,
    JobSearchOccupation,
    KeyResult,
    KeyResultTemplate,
    KeyResultUpdate,
    Organization,
    OrganizationAward,
    OrganizationContact,
    OrganizationDepartment,
    OrganizationDocument,
    OrganizationEmploymentType,
    OrganizationLanguage,
    OrganizationPosition,
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
    ProductVariant,
    ProductVariantPrice,
    ProductVariantSetting,
    Proposal,
    RequestApproval,
    Screenshot,
    Skill,
    Tag,
    Task,
    TenantSetting,
    TimeLog,
    TimeOffPolicy,
    TimeOffRequest,
    Timesheet,
    TimeSlot,
    User,
    UserOrganization
} from '../../core/entities/internal';
import { TypeOrmActivityRepository } from './../../time-tracking/activity/repository/type-orm-activity.repository';
import { MikroOrmActivityRepository } from './../../time-tracking/activity/repository/mikro-orm-activity.repository';

@Injectable()
export class FactoryResetService {

    repositories: Repository<any>[];

    constructor(
        @InjectRepository(Activity)
        private typeOrmActivityRepository: TypeOrmActivityRepository,

        private mikroOrmActivityRepository: MikroOrmActivityRepository,

        @InjectRepository(AppointmentEmployee)
        private readonly appointmentEmployeesRepository: Repository<AppointmentEmployee>,

        @MikroInjectRepository(AppointmentEmployee)
        private readonly mikroAppointmentEmployeesRepository: EntityRepository<AppointmentEmployee>,

        @InjectRepository(ApprovalPolicy)
        private readonly approvalPolicyRepository: Repository<ApprovalPolicy>,

        @MikroInjectRepository(ApprovalPolicy)
        private readonly mikroApprovalPolicyRepository: EntityRepository<ApprovalPolicy>,

        @InjectRepository(AvailabilitySlot)
        private readonly availabilitySlotsRepository: Repository<AvailabilitySlot>,

        @MikroInjectRepository(AvailabilitySlot)
        private readonly mikroAvailabilitySlotsRepository: EntityRepository<AvailabilitySlot>,

        @InjectRepository(Candidate)
        private readonly candidateRepository: Repository<Candidate>,

        @MikroInjectRepository(Candidate)
        private readonly mikroCandidateRepository: EntityRepository<Candidate>,

        @InjectRepository(CandidateCriterionsRating)
        private readonly candidateCriterionsRatingRepository: Repository<CandidateCriterionsRating>,

        @MikroInjectRepository(CandidateCriterionsRating)
        private readonly mikroCandidateCriterionsRatingRepository: EntityRepository<CandidateCriterionsRating>,

        @InjectRepository(CandidateDocument)
        private readonly candidateDocumentRepository: Repository<CandidateDocument>,

        @MikroInjectRepository(CandidateDocument)
        private readonly mikroCandidateDocumentRepository: EntityRepository<CandidateDocument>,

        @InjectRepository(CandidateEducation)
        private readonly candidateEducationRepository: Repository<CandidateEducation>,

        @MikroInjectRepository(CandidateEducation)
        private readonly mikroCandidateEducationRepository: EntityRepository<CandidateEducation>,

        @InjectRepository(CandidateExperience)
        private readonly candidateExperienceRepository: Repository<CandidateExperience>,

        @MikroInjectRepository(CandidateExperience)
        private readonly mikroCandidateExperienceRepository: EntityRepository<CandidateExperience>,

        @InjectRepository(CandidateFeedback)
        private readonly candidateFeedbackRepository: Repository<CandidateFeedback>,

        @MikroInjectRepository(CandidateFeedback)
        private readonly mikroCandidateFeedbackRepository: EntityRepository<CandidateFeedback>,

        @InjectRepository(CandidateInterview)
        private readonly candidateInterviewRepository: Repository<CandidateInterview>,

        @MikroInjectRepository(CandidateInterview)
        private readonly mikroCandidateInterviewRepository: EntityRepository<CandidateInterview>,

        @InjectRepository(CandidateInterviewers)
        private readonly candidateInterviewersRepository: Repository<CandidateInterviewers>,

        @MikroInjectRepository(CandidateInterviewers)
        private readonly mikroCandidateInterviewersRepository: EntityRepository<CandidateInterviewers>,

        @InjectRepository(CandidateSkill)
        private readonly candidateSkillRepository: Repository<CandidateSkill>,

        @MikroInjectRepository(CandidateSkill)
        private readonly mikroCandidateSkillRepository: EntityRepository<CandidateSkill>,

        @InjectRepository(CandidateSource)
        private readonly candidateSourceRepository: Repository<CandidateSource>,

        @MikroInjectRepository(CandidateSource)
        private readonly mikroCandidateSourceRepository: EntityRepository<CandidateSource>,

        @InjectRepository(CandidateTechnologies)
        private readonly candidateTechnologiesRepository: Repository<CandidateTechnologies>,

        @MikroInjectRepository(CandidateTechnologies)
        private readonly mikroCandidateTechnologiesRepository: EntityRepository<CandidateTechnologies>,

        @InjectRepository(Contact)
        private readonly contactRepository: Repository<Contact>,

        @MikroInjectRepository(Contact)
        private readonly mikroContactRepository: EntityRepository<Contact>,

        @InjectRepository(Deal)
        private readonly dealRepository: Repository<Deal>,

        @MikroInjectRepository(Deal)
        private readonly mikroDealRepository: EntityRepository<Deal>,

        @InjectRepository(EmailHistory)
        private readonly emailHistoryRepository: Repository<EmailHistory>,

        @MikroInjectRepository(EmailHistory)
        private readonly mikroEmailHistoryRepository: EntityRepository<EmailHistory>,

        @InjectRepository(Employee)
        private readonly employeeRepository: Repository<Employee>,

        @MikroInjectRepository(Employee)
        private readonly mikroEmployeeRepository: EntityRepository<Employee>,

        @InjectRepository(EmployeeAppointment)
        private readonly employeeAppointmentRepository: Repository<EmployeeAppointment>,

        @MikroInjectRepository(EmployeeAppointment)
        private readonly mikroEmployeeAppointmentRepository: EntityRepository<EmployeeAppointment>,

        @InjectRepository(EmployeeAward)
        private readonly employeeAwardRepository: Repository<EmployeeAward>,

        @MikroInjectRepository(EmployeeAward)
        private readonly mikroEmployeeAwardRepository: EntityRepository<EmployeeAward>,

        @InjectRepository(EmployeeProposalTemplate)
        private readonly employeeProposalTemplateRepository: Repository<EmployeeProposalTemplate>,

        @MikroInjectRepository(EmployeeProposalTemplate)
        private readonly mikroEmployeeProposalTemplateRepository: EntityRepository<EmployeeProposalTemplate>,

        @InjectRepository(EmployeeRecurringExpense)
        private readonly employeeRecurringExpenseRepository: Repository<EmployeeRecurringExpense>,

        @MikroInjectRepository(EmployeeRecurringExpense)
        private readonly mikroEmployeeRecurringExpenseRepository: EntityRepository<EmployeeRecurringExpense>,

        @InjectRepository(EmployeeSetting)
        private readonly employeeSettingRepository: Repository<EmployeeSetting>,

        @MikroInjectRepository(EmployeeSetting)
        private readonly mikroEmployeeSettingRepository: EntityRepository<EmployeeSetting>,

        @InjectRepository(Equipment)
        private readonly equipmentRepository: Repository<Equipment>,

        @MikroInjectRepository(Equipment)
        private readonly mikroEquipmentRepository: EntityRepository<Equipment>,

        @InjectRepository(EquipmentSharing)
        private readonly equipmentSharingRepository: Repository<EquipmentSharing>,

        @MikroInjectRepository(EquipmentSharing)
        private readonly mikroEquipmentSharingRepository: EntityRepository<EquipmentSharing>,

        @InjectRepository(EstimateEmail)
        private readonly estimateEmailRepository: Repository<EstimateEmail>,

        @MikroInjectRepository(EstimateEmail)
        private readonly mikroEstimateEmailRepository: EntityRepository<EstimateEmail>,

        @InjectRepository(EventType)
        private readonly eventTypeRepository: Repository<EventType>,

        @MikroInjectRepository(EventType)
        private readonly mikroEventTypeRepository: EntityRepository<EventType>,

        @InjectRepository(Expense)
        private readonly expenseRepository: Repository<Expense>,

        @MikroInjectRepository(Expense)
        private readonly mikroExpenseRepository: EntityRepository<Expense>,

        @InjectRepository(ExpenseCategory)
        private readonly expenseCategoryRepository: Repository<ExpenseCategory>,

        @MikroInjectRepository(ExpenseCategory)
        private readonly mikroExpenseCategoryRepository: EntityRepository<ExpenseCategory>,

        @InjectRepository(FeatureOrganization)
        private readonly featureOrganizationRepository: Repository<FeatureOrganization>,

        @MikroInjectRepository(FeatureOrganization)
        private readonly mikroFeatureOrganizationRepository: EntityRepository<FeatureOrganization>,

        @InjectRepository(Goal)
        private readonly goalRepository: Repository<Goal>,

        @MikroInjectRepository(Goal)
        private readonly mikroGoalRepository: EntityRepository<Goal>,

        @InjectRepository(GoalTemplate)
        private readonly goalTemplateRepository: Repository<GoalTemplate>,

        @MikroInjectRepository(GoalTemplate)
        private readonly mikroGoalTemplateRepository: EntityRepository<GoalTemplate>,

        @InjectRepository(GoalKPI)
        private readonly goalKpiRepository: Repository<GoalKPI>,

        @MikroInjectRepository(GoalKPI)
        private readonly mikroGoalKpiRepository: EntityRepository<GoalKPI>,

        @InjectRepository(GoalKPITemplate)
        private readonly goalKpiTemplateRepository: Repository<GoalKPITemplate>,

        @MikroInjectRepository(GoalKPITemplate)
        private readonly mikroGoalKpiTemplateRepository: EntityRepository<GoalKPITemplate>,

        @InjectRepository(GoalTimeFrame)
        private readonly goalTimeFrameRepository: Repository<GoalTimeFrame>,

        @MikroInjectRepository(GoalTimeFrame)
        private readonly mikroGoalTimeFrameRepository: EntityRepository<GoalTimeFrame>,

        @InjectRepository(Income)
        private readonly incomeRepository: Repository<Income>,

        @MikroInjectRepository(Income)
        private readonly mikroIncomeRepository: EntityRepository<Income>,

        @InjectRepository(IntegrationEntitySetting)
        private readonly integrationEntitySettingRepository: Repository<IntegrationEntitySetting>,

        @MikroInjectRepository(IntegrationEntitySetting)
        private readonly mikroIntegrationEntitySettingRepository: EntityRepository<IntegrationEntitySetting>,

        @InjectRepository(IntegrationEntitySettingTied)
        private readonly integrationEntitySettingTiedRepository: Repository<IntegrationEntitySettingTied>,

        @MikroInjectRepository(IntegrationEntitySettingTied)
        private readonly mikroIntegrationEntitySettingTiedRepository: EntityRepository<IntegrationEntitySettingTied>,

        @InjectRepository(IntegrationMap)
        private readonly integrationMapRepository: Repository<IntegrationMap>,

        @MikroInjectRepository(IntegrationMap)
        private readonly mikroIntegrationMapRepository: EntityRepository<IntegrationMap>,

        @InjectRepository(IntegrationSetting)
        private readonly integrationSettingRepository: Repository<IntegrationSetting>,

        @MikroInjectRepository(IntegrationSetting)
        private readonly mikroIntegrationSettingRepository: EntityRepository<IntegrationSetting>,

        @InjectRepository(IntegrationTenant)
        private readonly integrationTenantRepository: Repository<IntegrationTenant>,

        @MikroInjectRepository(IntegrationTenant)
        private readonly mikroIntegrationTenantRepository: EntityRepository<IntegrationTenant>,

        @InjectRepository(Invite)
        private readonly inviteRepository: Repository<Invite>,

        @MikroInjectRepository(Invite)
        private readonly mikroInviteRepository: EntityRepository<Invite>,

        @InjectRepository(Invoice)
        private readonly invoiceRepository: Repository<Invoice>,

        @MikroInjectRepository(Invoice)
        private readonly mikroInvoiceRepository: EntityRepository<Invoice>,

        @InjectRepository(InvoiceEstimateHistory)
        private readonly invoiceEstimateHistoryRepository: Repository<InvoiceEstimateHistory>,

        @MikroInjectRepository(InvoiceEstimateHistory)
        private readonly mikroInvoiceEstimateHistoryRepository: EntityRepository<InvoiceEstimateHistory>,

        @InjectRepository(InvoiceItem)
        private readonly invoiceItemRepository: Repository<InvoiceItem>,

        @MikroInjectRepository(InvoiceItem)
        private readonly mikroInvoiceItemRepository: EntityRepository<InvoiceItem>,

        @InjectRepository(JobPreset)
        private readonly jobPresetRepository: Repository<JobPreset>,

        @MikroInjectRepository(JobPreset)
        private readonly mikroJobPresetRepository: EntityRepository<JobPreset>,

        @InjectRepository(JobSearchCategory)
        private readonly jobSearchCategoryRepository: Repository<JobSearchCategory>,

        @MikroInjectRepository(JobSearchCategory)
        private readonly mikroJobSearchCategoryRepository: EntityRepository<JobSearchCategory>,

        @InjectRepository(JobSearchOccupation)
        private readonly jobSearchOccupationRepository: Repository<JobSearchOccupation>,

        @MikroInjectRepository(JobSearchOccupation)
        private readonly mikroJobSearchOccupationRepository: EntityRepository<JobSearchOccupation>,

        @InjectRepository(KeyResult)
        private readonly keyResultRepository: Repository<KeyResult>,

        @MikroInjectRepository(KeyResult)
        private readonly mikroKeyResultRepository: EntityRepository<KeyResult>,

        @InjectRepository(KeyResultTemplate)
        private readonly keyResultTemplateRepository: Repository<KeyResultTemplate>,

        @MikroInjectRepository(KeyResultTemplate)
        private readonly mikroKeyResultTemplateRepository: EntityRepository<KeyResultTemplate>,

        @InjectRepository(KeyResultUpdate)
        private readonly keyResultUpdateRepository: Repository<KeyResultUpdate>,

        @MikroInjectRepository(KeyResultUpdate)
        private readonly mikroKeyResultUpdateRepository: EntityRepository<KeyResultUpdate>,

        @InjectRepository(EmployeeLevel)
        private readonly employeeLevelRepository: Repository<EmployeeLevel>,

        @MikroInjectRepository(EmployeeLevel)
        private readonly mikroEmployeeLevelRepository: EntityRepository<EmployeeLevel>,

        @InjectRepository(OrganizationAward)
        private readonly organizationAwardRepository: Repository<OrganizationAward>,

        @MikroInjectRepository(OrganizationAward)
        private readonly mikroOrganizationAwardRepository: EntityRepository<OrganizationAward>,

        @InjectRepository(Organization)
        private readonly organizationRepository: Repository<Organization>,

        @MikroInjectRepository(Organization)
        private readonly mikroOrganizationRepository: EntityRepository<Organization>,

        @InjectRepository(OrganizationContact)
        private readonly organizationContactRepository: Repository<OrganizationContact>,

        @MikroInjectRepository(OrganizationContact)
        private readonly mikroOrganizationContactRepository: EntityRepository<OrganizationContact>,

        @InjectRepository(OrganizationDepartment)
        private readonly organizationDepartmentRepository: Repository<OrganizationDepartment>,

        @MikroInjectRepository(OrganizationDepartment)
        private readonly mikroOrganizationDepartmentRepository: EntityRepository<OrganizationDepartment>,

        @InjectRepository(OrganizationDocument)
        private readonly organizationDocumentRepository: Repository<OrganizationDocument>,

        @MikroInjectRepository(OrganizationDocument)
        private readonly mikroOrganizationDocumentRepository: EntityRepository<OrganizationDocument>,

        @InjectRepository(OrganizationEmploymentType)
        private readonly organizationEmploymentTypeRepository: Repository<OrganizationEmploymentType>,

        @MikroInjectRepository(OrganizationEmploymentType)
        private readonly mikroOrganizationEmploymentTypeRepository: EntityRepository<OrganizationEmploymentType>,

        @InjectRepository(OrganizationLanguage)
        private readonly organizationLanguageRepository: Repository<OrganizationLanguage>,

        @MikroInjectRepository(OrganizationLanguage)
        private readonly mikroOrganizationLanguageRepository: EntityRepository<OrganizationLanguage>,

        @InjectRepository(OrganizationPosition)
        private readonly organizationPositionRepository: Repository<OrganizationPosition>,

        @MikroInjectRepository(OrganizationPosition)
        private readonly mikroOrganizationPositionRepository: EntityRepository<OrganizationPosition>,

        @InjectRepository(OrganizationProject)
        private readonly organizationProjectsRepository: Repository<OrganizationProject>,

        @MikroInjectRepository(OrganizationProject)
        private readonly mikroOrganizationProjectsRepository: EntityRepository<OrganizationProject>,

        @InjectRepository(OrganizationRecurringExpense)
        private readonly organizationRecurringExpenseRepository: Repository<OrganizationRecurringExpense>,

        @MikroInjectRepository(OrganizationRecurringExpense)
        private readonly mikroOrganizationRecurringExpenseRepository: EntityRepository<OrganizationRecurringExpense>,

        @InjectRepository(OrganizationSprint)
        private readonly organizationSprintRepository: Repository<OrganizationSprint>,

        @MikroInjectRepository(OrganizationSprint)
        private readonly mikroOrganizationSprintRepository: EntityRepository<OrganizationSprint>,

        @InjectRepository(OrganizationTeam)
        private readonly organizationTeamRepository: Repository<OrganizationTeam>,

        @MikroInjectRepository(OrganizationTeam)
        private readonly mikroOrganizationTeamRepository: EntityRepository<OrganizationTeam>,

        @InjectRepository(OrganizationTeamEmployee)
        private readonly organizationTeamEmployeeRepository: Repository<OrganizationTeamEmployee>,

        @MikroInjectRepository(OrganizationTeamEmployee)
        private readonly mikroOrganizationTeamEmployeeRepository: EntityRepository<OrganizationTeamEmployee>,

        @InjectRepository(OrganizationVendor)
        private readonly organizationVendorsRepository: Repository<OrganizationVendor>,

        @MikroInjectRepository(OrganizationVendor)
        private readonly mikroOrganizationVendorsRepository: EntityRepository<OrganizationVendor>,

        @InjectRepository(Payment)
        private readonly paymentRepository: Repository<Payment>,

        @MikroInjectRepository(Payment)
        private readonly mikroPaymentRepository: EntityRepository<Payment>,

        @InjectRepository(Pipeline)
        private readonly pipelineRepository: Repository<Pipeline>,

        @MikroInjectRepository(Pipeline)
        private readonly mikroPipelineRepository: EntityRepository<Pipeline>,

        @InjectRepository(PipelineStage)
        private readonly stageRepository: Repository<PipelineStage>,

        @MikroInjectRepository(PipelineStage)
        private readonly mikroStageRepository: EntityRepository<PipelineStage>,

        @InjectRepository(Product)
        private readonly productRepository: Repository<Product>,

        @MikroInjectRepository(Product)
        private readonly mikroProductRepository: EntityRepository<Product>,

        @InjectRepository(ProductCategory)
        private readonly productCategoryRepository: Repository<ProductCategory>,

        @MikroInjectRepository(ProductCategory)
        private readonly mikroProductCategoryRepository: EntityRepository<ProductCategory>,

        @InjectRepository(ProductOption)
        private readonly productOptionRepository: Repository<ProductOption>,

        @MikroInjectRepository(ProductOption)
        private readonly mikroProductOptionRepository: EntityRepository<ProductOption>,

        @InjectRepository(ProductVariantSetting)
        private readonly productVariantSettingRepository: Repository<ProductVariantSetting>,

        @MikroInjectRepository(ProductVariantSetting)
        private readonly mikroProductVariantSettingRepository: EntityRepository<ProductVariantSetting>,

        @InjectRepository(ProductVariant)
        private readonly productVariantRepository: Repository<ProductVariant>,

        @MikroInjectRepository(ProductVariant)
        private readonly mikroProductVariantRepository: EntityRepository<ProductVariant>,

        @InjectRepository(ProductVariantPrice)
        private readonly productVariantPriceRepository: Repository<ProductVariantPrice>,

        @MikroInjectRepository(ProductVariantPrice)
        private readonly mikroProductVariantPriceRepository: EntityRepository<ProductVariantPrice>,

        @InjectRepository(Proposal)
        private readonly proposalRepository: Repository<Proposal>,

        @MikroInjectRepository(Proposal)
        private readonly mikroProposalRepository: EntityRepository<Proposal>,

        @InjectRepository(Skill)
        private readonly skillRepository: Repository<Skill>,

        @MikroInjectRepository(Skill)
        private readonly mikroSkillRepository: EntityRepository<Skill>,

        @InjectRepository(Screenshot)
        private readonly screenShotRepository: Repository<Screenshot>,

        @MikroInjectRepository(Screenshot)
        private readonly mikroScreenShotRepository: EntityRepository<Screenshot>,

        @InjectRepository(RequestApproval)
        private readonly requestApprovalRepository: Repository<RequestApproval>,

        @MikroInjectRepository(RequestApproval)
        private readonly mikroRequestApprovalRepository: EntityRepository<RequestApproval>,

        @InjectRepository(Tag)
        private readonly tagRepository: Repository<Tag>,

        @MikroInjectRepository(Tag)
        private readonly mikroTagRepository: EntityRepository<Tag>,

        @InjectRepository(Task)
        private readonly taskRepository: Repository<Task>,

        @MikroInjectRepository(Task)
        private readonly mikroTaskRepository: EntityRepository<Task>,

        @InjectRepository(Timesheet)
        private readonly timeSheetRepository: Repository<Timesheet>,

        @MikroInjectRepository(Timesheet)
        private readonly mikroTimeSheetRepository: EntityRepository<Timesheet>,

        @InjectRepository(TimeLog)
        private readonly timeLogRepository: Repository<TimeLog>,

        @MikroInjectRepository(TimeLog)
        private readonly mikroTimeLogRepository: EntityRepository<TimeLog>,

        @InjectRepository(TimeSlot)
        private readonly timeSlotRepository: Repository<TimeSlot>,

        @MikroInjectRepository(TimeSlot)
        private readonly mikroTimeSlotRepository: EntityRepository<TimeSlot>,

        @InjectRepository(TimeOffRequest)
        private readonly timeOffRequestRepository: Repository<TimeOffRequest>,

        @MikroInjectRepository(TimeOffRequest)
        private readonly mikroTimeOffRequestRepository: EntityRepository<TimeOffRequest>,

        @InjectRepository(TimeOffPolicy)
        private readonly timeOffPolicyRepository: Repository<TimeOffPolicy>,

        @MikroInjectRepository(TimeOffPolicy)
        private readonly mikroTimeOffPolicyRepository: EntityRepository<TimeOffPolicy>,

        @InjectRepository(TenantSetting)
        private readonly tenantSettingRepository: Repository<TenantSetting>,

        @MikroInjectRepository(TenantSetting)
        private readonly mikroTenantSettingRepository: EntityRepository<TenantSetting>,

        @InjectRepository(User)
        private readonly userRepository: Repository<User>,

        @MikroInjectRepository(User)
        private readonly mikroUserRepository: EntityRepository<User>,

        @InjectRepository(UserOrganization)
        private readonly userOrganizationRepository: Repository<UserOrganization>,

        @MikroInjectRepository(UserOrganization)
        private readonly mikroUserOrganizationRepository: EntityRepository<UserOrganization>,

        private readonly configService: ConfigService
    ) { }

    async onModuleInit() {
        this.registerCoreRepositories();
    }

    async reset() {
        if (this.configService.get('demo') === true) {
            throw new ForbiddenException();
        }
        const userId = RequestContext.currentUserId();
        const tenantId = RequestContext.currentTenantId();

        const user = await this.userRepository.findOneBy({
            id: userId,
            tenantId
        });
        user.thirdPartyId = null;
        user.preferredLanguage = null;
        user.preferredComponentLayout = null;
        user.employeeId = null;
        await this.userRepository.save(user);

        const oldOrganization: any = await this.userOrganizationRepository.findOne({
            order: {
                createdAt: "ASC"
            },
            select: ["organizationId"],
            where: {
                userId: userId
            }
        });
        const organizations: any = await this.userOrganizationRepository.find({
            select: ["organizationId"],
            where: {
                userId: userId
            }
        });

        const allOrganizationsIds = map(organizations, (org) => {
            return org.organizationId
        });
        const deleteOrganizationIds = filter(allOrganizationsIds, (organizationsId) => {
            return organizationsId != oldOrganization.organizationId
        });

        const findInput = {
            organizationIds: allOrganizationsIds,
            tenantId: user.tenantId
        }

        await this.deleteSpecificTables(findInput)
        if (deleteOrganizationIds?.length > 0) {
            await this.userOrganizationRepository.delete({
                userId: userId,
                organizationId: In(deleteOrganizationIds),
                tenantId: user.tenantId
            });
            await this.organizationRepository.delete({
                id: In(deleteOrganizationIds),
                tenantId: user.tenantId
            });
        }

        const firstOrganization = await this.organizationRepository.findOneBy({
            id: oldOrganization.organizationId,
        });

        return firstOrganization;
    }

    async deleteSpecificTables(
        findInput: {
            organizationIds: string[];
            tenantId: string;
        }
    ) {
        for (let i = 0; i < this.repositories.length; i++) {
            await this.deleteRepository(this.repositories[i], findInput)
        }
        return
    }

    async deleteRepository(
        repository: Repository<any>,
        findInput: {
            organizationIds: string[];
            tenantId: string;
        }
    ): Promise<any> {
        let conditions: any = {};
        const columns = repository.metadata.ownColumns.map(column => column.propertyName);
        const tenantId = some(columns, (column) => {
            return column === 'tenantId';
        })
        const organizationId = some(columns, (column) => {
            return column === 'organizationId';
        })

        if (tenantId && organizationId) {
            conditions = {
                tenantId: findInput['tenantId'],
                organizationId: In(findInput['organizationIds'])
            };
        }
        if (tenantId && !organizationId) {
            conditions = {
                tenantId: findInput['tenantId']
            };
        }
        return repository.delete(conditions);
    }

    private registerCoreRepositories() {
        this.repositories = [
            this.tagRepository,
            this.typeOrmActivityRepository,
            this.approvalPolicyRepository,
            this.appointmentEmployeesRepository,
            this.availabilitySlotsRepository,
            this.candidateCriterionsRatingRepository,
            this.candidateDocumentRepository,
            this.candidateEducationRepository,
            this.candidateExperienceRepository,
            this.candidateFeedbackRepository,
            this.candidateInterviewersRepository,
            this.candidateInterviewRepository,
            this.candidateRepository,
            this.candidateSkillRepository,
            this.candidateSourceRepository,
            this.candidateTechnologiesRepository,
            this.dealRepository,
            this.keyResultRepository,
            this.keyResultTemplateRepository,
            this.keyResultUpdateRepository,
            this.goalKpiRepository,
            this.goalKpiTemplateRepository,
            this.goalRepository,
            this.goalTemplateRepository,
            this.goalTimeFrameRepository,
            this.emailHistoryRepository,
            this.timeLogRepository,
            this.timeOffPolicyRepository,
            this.timeOffRequestRepository,
            this.timeSheetRepository,
            this.timeSlotRepository,
            this.invoiceItemRepository,
            this.invoiceEstimateHistoryRepository,
            this.invoiceRepository,
            this.featureOrganizationRepository,
            this.jobPresetRepository,
            this.jobSearchCategoryRepository,
            this.jobSearchOccupationRepository,
            this.employeeAppointmentRepository,
            this.employeeAwardRepository,
            this.employeeLevelRepository,
            this.employeeProposalTemplateRepository,
            this.employeeRecurringExpenseRepository,
            this.employeeRepository,
            this.employeeSettingRepository,
            this.equipmentSharingRepository,
            this.equipmentRepository,
            this.estimateEmailRepository,
            this.eventTypeRepository,
            this.expenseCategoryRepository,
            this.expenseRepository,
            this.incomeRepository,
            this.integrationEntitySettingRepository,
            this.integrationEntitySettingTiedRepository,
            this.integrationMapRepository,
            this.integrationSettingRepository,
            this.integrationTenantRepository,
            this.inviteRepository,
            this.organizationAwardRepository,
            this.organizationDepartmentRepository,
            this.organizationDocumentRepository,
            this.organizationEmploymentTypeRepository,
            this.organizationLanguageRepository,
            this.organizationPositionRepository,
            this.organizationSprintRepository,
            this.organizationTeamEmployeeRepository,
            this.organizationTeamRepository,
            this.organizationVendorsRepository,
            this.organizationRecurringExpenseRepository,
            this.organizationProjectsRepository,
            this.organizationContactRepository,
            this.productCategoryRepository,
            this.productOptionRepository,
            this.productRepository,
            this.productVariantPriceRepository,
            this.productVariantRepository,
            this.productVariantSettingRepository,
            this.paymentRepository,
            this.pipelineRepository,
            this.proposalRepository,
            this.requestApprovalRepository,
            this.screenShotRepository,
            this.skillRepository,
            this.stageRepository,
            this.contactRepository,
            this.taskRepository,
            this.tenantSettingRepository,
        ];
    }
}
