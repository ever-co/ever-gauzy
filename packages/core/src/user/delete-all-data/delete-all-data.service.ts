// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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
    Email,
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
    IntegrationEntitySettingTiedEntity,
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
    OrganizationAwards,
    OrganizationContact,
    OrganizationDepartment,
    OrganizationDocument,
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
    ProductVariant,
    ProductVariantPrice,
    ProductVariantSettings,
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
} from './../../core/entities/internal';

@Injectable()
export class DeleteAllDataService {

    repositories: Repository<any>[];

    constructor(
        @InjectRepository(Activity)
        private readonly activityRepository: Repository<Activity>,

        @InjectRepository(AppointmentEmployee)
        private readonly appointmentEmployeesRepository: Repository<AppointmentEmployee>,

        @InjectRepository(ApprovalPolicy)
        private readonly approvalPolicyRepository: Repository<ApprovalPolicy>,

        @InjectRepository(AvailabilitySlot)
        private readonly availabilitySlotsRepository: Repository<AvailabilitySlot>,

        @InjectRepository(Candidate)
        private readonly candidateRepository: Repository<Candidate>,

        @InjectRepository(CandidateCriterionsRating)
        private readonly candidateCriterionsRatingRepository: Repository<CandidateCriterionsRating>,

        @InjectRepository(CandidateDocument)
        private readonly candidateDocumentRepository: Repository<CandidateDocument>,

        @InjectRepository(CandidateEducation)
        private readonly candidateEducationRepository: Repository<CandidateEducation>,

        @InjectRepository(CandidateExperience)
        private readonly candidateExperienceRepository: Repository<CandidateExperience>,

        @InjectRepository(CandidateFeedback)
        private readonly candidateFeedbackRepository: Repository<CandidateFeedback>,

        @InjectRepository(CandidateInterview)
        private readonly candidateInterviewRepository: Repository<CandidateInterview>,

        @InjectRepository(CandidateInterviewers)
        private readonly candidateInterviewersRepository: Repository<CandidateInterviewers>,

        @InjectRepository(CandidateSkill)
        private readonly candidateSkillRepository: Repository<CandidateSkill>,

        @InjectRepository(CandidateSource)
        private readonly candidateSourceRepository: Repository<CandidateSource>,

        @InjectRepository(CandidateTechnologies)
        private readonly candidateTechnologiesRepository: Repository<CandidateTechnologies>,

        @InjectRepository(Contact)
        private readonly contactRepository: Repository<Contact>,

        @InjectRepository(Deal)
        private readonly dealRepository: Repository<Deal>,

        @InjectRepository(Email)
        private readonly emailRepository: Repository<Email>,

        @InjectRepository(Employee)
        private readonly employeeRepository: Repository<Employee>,

        @InjectRepository(EmployeeAppointment)
        private readonly employeeAppointmentRepository: Repository<EmployeeAppointment>,

        @InjectRepository(EmployeeAward)
        private readonly employeeAwardRepository: Repository<EmployeeAward>,

        @InjectRepository(EmployeeProposalTemplate)
        private readonly employeeProposalTemplateRepository: Repository<EmployeeProposalTemplate>,

        @InjectRepository(EmployeeRecurringExpense)
        private readonly employeeRecurringExpenseRepository: Repository<EmployeeRecurringExpense>,

        @InjectRepository(EmployeeSetting)
        private readonly employeeSettingRepository: Repository<EmployeeSetting>,

        @InjectRepository(Equipment)
        private readonly equipmentRepository: Repository<Equipment>,

        @InjectRepository(EquipmentSharing)
        private readonly equipmentSharingRepository: Repository<EquipmentSharing>,

        @InjectRepository(EstimateEmail)
        private readonly estimateEmailRepository: Repository<EstimateEmail>,

        @InjectRepository(EventType)
        private readonly eventTypeRepository: Repository<EventType>,

        @InjectRepository(Expense)
        private readonly expenseRepository: Repository<Expense>,

        @InjectRepository(ExpenseCategory)
        private readonly expenseCategoryRepository: Repository<ExpenseCategory>,

        @InjectRepository(FeatureOrganization)
        private readonly featureOrganizationRepository: Repository<FeatureOrganization>,

        @InjectRepository(Goal)
        private readonly goalRepository: Repository<Goal>,

        @InjectRepository(GoalTemplate)
        private readonly goalTemplateRepository: Repository<GoalTemplate>,

        @InjectRepository(GoalKPI)
        private readonly goalKpiRepository: Repository<GoalKPI>,

        @InjectRepository(GoalKPITemplate)
        private readonly goalKpiTemplateRepository: Repository<GoalKPITemplate>,

        @InjectRepository(GoalTimeFrame)
        private readonly goalTimeFrameRepository: Repository<GoalTimeFrame>,

        @InjectRepository(Income)
        private readonly incomeRepository: Repository<Income>,

        @InjectRepository(IntegrationEntitySetting)
        private readonly integrationEntitySettingRepository: Repository<IntegrationEntitySetting>,

        @InjectRepository(IntegrationEntitySettingTiedEntity)
        private readonly integrationEntitySettingTiedEntityRepository: Repository<IntegrationEntitySettingTiedEntity>,

        @InjectRepository(IntegrationMap)
        private readonly integrationMapRepository: Repository<IntegrationMap>,

        @InjectRepository(IntegrationSetting)
        private readonly integrationSettingRepository: Repository<IntegrationSetting>,

        @InjectRepository(IntegrationTenant)
        private readonly integrationTenantRepository: Repository<IntegrationTenant>,

        @InjectRepository(Invite)
        private readonly inviteRepository: Repository<Invite>,

        @InjectRepository(Invoice)
        private readonly invoiceRepository: Repository<Invoice>,

        @InjectRepository(InvoiceEstimateHistory)
        private readonly invoiceEstimateHistoryRepository: Repository<InvoiceEstimateHistory>,

        @InjectRepository(InvoiceItem)
        private readonly invoiceItemRepository: Repository<InvoiceItem>,

        @InjectRepository(JobPreset)
        private readonly jobPresetRepository: Repository<JobPreset>,

        @InjectRepository(JobSearchCategory)
        private readonly jobSearchCategoryRepository: Repository<JobSearchCategory>,

        @InjectRepository(JobSearchOccupation)
        private readonly jobSearchOccupationRepository: Repository<JobSearchOccupation>,

        @InjectRepository(KeyResult)
        private readonly keyResultRepository: Repository<KeyResult>,

        @InjectRepository(KeyResultTemplate)
        private readonly keyResultTemplateRepository: Repository<KeyResultTemplate>,

        @InjectRepository(KeyResultUpdate)
        private readonly keyResultUpdateRepository: Repository<KeyResultUpdate>,

        @InjectRepository(EmployeeLevel)
        private readonly employeeLevelRepository: Repository<EmployeeLevel>,

        @InjectRepository(OrganizationAwards)
        private readonly organizationAwardsRepository: Repository<OrganizationAwards>,

        @InjectRepository(Organization)
        private readonly organizationRepository: Repository<Organization>,

        @InjectRepository(OrganizationContact)
        private readonly organizationContactRepository: Repository<OrganizationContact>,

        @InjectRepository(OrganizationDepartment)
        private readonly organizationDepartmentRepository: Repository<OrganizationDepartment>,

        @InjectRepository(OrganizationDocument)
        private readonly organizationDocumentRepository: Repository<OrganizationDocument>,

        @InjectRepository(OrganizationEmploymentType)
        private readonly organizationEmploymentTypeRepository: Repository<OrganizationEmploymentType>,

        @InjectRepository(OrganizationLanguages)
        private readonly organizationLanguagesRepository: Repository<OrganizationLanguages>,

        @InjectRepository(OrganizationPositions)
        private readonly organizationPositionsRepository: Repository<OrganizationPositions>,

        @InjectRepository(OrganizationProject)
        private readonly organizationProjectsRepository: Repository<OrganizationProject>,

        @InjectRepository(OrganizationRecurringExpense)
        private readonly organizationRecurringExpenseRepository: Repository<OrganizationRecurringExpense>,

        @InjectRepository(OrganizationSprint)
        private readonly organizationSprintRepository: Repository<OrganizationSprint>,

        @InjectRepository(OrganizationTeam)
        private readonly organizationTeamRepository: Repository<OrganizationTeam>,

        @InjectRepository(OrganizationTeamEmployee)
        private readonly organizationTeamEmployeeRepository: Repository<OrganizationTeamEmployee>,

        @InjectRepository(OrganizationVendor)
        private readonly organizationVendorsRepository: Repository<OrganizationVendor>,

        @InjectRepository(Payment)
        private readonly paymentRepository: Repository<Payment>,

        @InjectRepository(Pipeline)
        private readonly pipelineRepository: Repository<Pipeline>,

        @InjectRepository(PipelineStage)
        private readonly stageRepository: Repository<PipelineStage>,

        @InjectRepository(Product)
        private readonly productRepository: Repository<Product>,

        @InjectRepository(ProductCategory)
        private readonly productCategoryRepository: Repository<ProductCategory>,

        @InjectRepository(ProductOption)
        private readonly productOptionRepository: Repository<ProductOption>,

        @InjectRepository(ProductVariantSettings)
        private readonly productVariantSettingsRepository: Repository<ProductVariantSettings>,

        @InjectRepository(ProductVariant)
        private readonly productVariantRepository: Repository<ProductVariant>,

        @InjectRepository(ProductVariantPrice)
        private readonly productVariantPriceRepository: Repository<ProductVariantPrice>,

        @InjectRepository(Proposal)
        private readonly proposalRepository: Repository<Proposal>,

        @InjectRepository(Skill)
        private readonly skillRepository: Repository<Skill>,

        @InjectRepository(Screenshot)
        private readonly screenShotRepository: Repository<Screenshot>,

        @InjectRepository(RequestApproval)
        private readonly requestApprovalRepository: Repository<RequestApproval>,

        @InjectRepository(Tag)
        private readonly tagRepository: Repository<Tag>,

        @InjectRepository(Task)
        private readonly taskRepository: Repository<Task>,

        @InjectRepository(Timesheet)
        private readonly timeSheetRepository: Repository<Timesheet>,

        @InjectRepository(TimeLog)
        private readonly timeLogRepository: Repository<TimeLog>,

        @InjectRepository(TimeSlot)
        private readonly timeSlotRepository: Repository<TimeSlot>,

        @InjectRepository(TimeOffRequest)
        private readonly timeOffRequestRepository: Repository<TimeOffRequest>,

        @InjectRepository(TimeOffPolicy)
        private readonly timeOffPolicyRepository: Repository<TimeOffPolicy>,
        @InjectRepository(TenantSetting)
        private readonly tenantSettingRepository: Repository<TenantSetting>,

        @InjectRepository(User)
        private readonly userRepository: Repository<User>,

        @InjectRepository(UserOrganization)
        private readonly userOrganizationRepository: Repository<UserOrganization>
    ) { }

    async onModuleInit() {
        this.registerCoreRepositories();
    }

    async deleteAllData(id: any) {

        const user = await this.userRepository.findOne(id);
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
                userId: id
            }
        });
        const organizations: any = await this.userOrganizationRepository.find({
            select: ["organizationId"],
            where: {
                userId: id
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
                userId: id,
                organizationId: In(deleteOrganizationIds),
                tenantId: user.tenantId
            });
            await this.organizationRepository.delete({
                id: In(deleteOrganizationIds),
                tenantId: user.tenantId
            });
        }

        const firstOrganization = await this.organizationRepository.findOne({
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
            this.activityRepository,
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
            this.emailRepository,
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
            this.integrationEntitySettingTiedEntityRepository,
            this.integrationMapRepository,
            this.integrationSettingRepository,
            this.integrationTenantRepository,
            this.inviteRepository,
            this.organizationAwardsRepository,
            this.organizationDepartmentRepository,
            this.organizationDocumentRepository,
            this.organizationEmploymentTypeRepository,
            this.organizationLanguagesRepository,
            this.organizationPositionsRepository,
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
            this.productVariantSettingsRepository,
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
