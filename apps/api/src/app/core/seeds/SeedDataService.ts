import { CandidateExperience } from './../../candidate-experience/candidate-experience.entity';
// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit.
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor

import { Injectable } from '@nestjs/common';
import {
	Connection,
	createConnection,
	getRepository,
	ConnectionOptions,
	getConnection
} from 'typeorm';
import chalk from 'chalk';
import { environment as env } from '@env-api/environment';
import { Role } from '../../role/role.entity';
import { createRoles } from '../../role/role.seed';
import { createSkills } from '../../skills/skill.seed';
import { createLanguages } from '../../language/language.seed';
import { User } from '../../user/user.entity';
import {
	createDefaultSuperAdminUsers,
	createDefaultUsers,
	createRandomSuperAdminUsers,
	createRandomUsers
} from '../../user/user.seed';
import { Employee } from '../../employee/employee.entity';
import {
	createDefaultEmployees,
	createRandomEmployees
} from '../../employee/employee.seed';
import { Organization } from '../../organization/organization.entity';
import {
	createDefaultOrganizations,
	createRandomOrganizations
} from '../../organization/organization.seed';
import { Income } from '../../income/income.entity';
import {
	createDefaultIncomes,
	createRandomIncomes
} from '../../income/income.seed';
import { Expense } from '../../expense/expense.entity';
import {
	createDefaultExpenses,
	createRandomExpenses
} from '../../expense/expense.seed';
import { EmployeeSetting } from '../../employee-setting/employee-setting.entity';
import {
	createDefaultUsersOrganizations,
	createRandomUsersOrganizations
} from '../../user-organization/user-organization.seed';
import { UserOrganization } from '../../user-organization/user-organization.entity';
import { createCountries } from '../../country/country.seed';
import { OrganizationTeam } from '../../organization-team/organization-team.entity';
import { OrganizationTeamEmployee } from '../../organization-team-employee/organization-team-employee.entity';
import { Country } from '../../country';
import {
	createDefaultTeams,
	createRandomTeam
} from '../../organization-team/organization-team.seed';
import { RolePermissions } from '../../role-permissions/role-permissions.entity';
import { createRolePermissions } from '../../role-permissions/role-permissions.seed';
import {
	createDefaultTenants,
	createRandomTenants
} from '../../tenant/tenant.seed';
import { EmailTemplate } from '../../email-template';
import { createDefaultEmailTemplates } from '../../email-template/email-template.seed';
import {
	seedDefaultEmploymentTypes,
	seedRandomEmploymentTypes
} from '../../organization-employment-type/organization-employment-type.seed';
import { OrganizationEmploymentType } from '../../organization-employment-type/organization-employment-type.entity';
import { createEmployeeLevels } from '../../organization_employeeLevel/organization-employee-level.seed';
import { EmployeeLevel } from '../../organization_employeeLevel/organization-employee-level.entity';
import {
	createDefaultTimeOffPolicy,
	createRandomTimeOffPolicies
} from '../../time-off-policy/time-off-policy.seed';
import {
	createDefaultApprovalPolicyForOrg,
	createRandomApprovalPolicyForOrg
} from '../../approval-policy/approval-policy.seed';
import {
	createExpenseCategories,
	createRandomExpenseCategories
} from '../../expense-categories/expense-categories.seed';
import {
	createOrganizationVendors,
	createRandomOrganizationVendors
} from '../../organization-vendors/organization-vendors.seed';
import { Invoice } from '../../invoice/invoice.entity';
import { InvoiceItem } from '../../invoice-item/invoice-item.entity';
import { TimeOffPolicy } from '../../time-off-policy/time-off-policy.entity';
import { Proposal } from '../../proposal/proposal.entity';
import { Invite } from '../../invite/invite.entity';
import { EmployeeRecurringExpense } from '../../employee-recurring-expense/employee-recurring-expense.entity';
import { ExpenseCategory } from '../../expense-categories/expense-category.entity';
import { EquipmentSharing } from '../../equipment-sharing/equipment-sharing.entity';
import { OrganizationContact } from '../../organization-contact/organization-contact.entity';
import { OrganizationVendor } from '../../organization-vendors/organization-vendors.entity';
import { OrganizationDepartment } from '../../organization-department/organization-department.entity';
import { OrganizationProjects } from '../../organization-projects/organization-projects.entity';
import { Task } from '../../tasks/task.entity';
import { Screenshot } from '../../timesheet/screenshot.entity';
import { Activity } from '../../timesheet/activity.entity';
import { TimeSlot } from '../../timesheet/time-slot.entity';
import { Timesheet } from '../../timesheet/timesheet.entity';
import { OrganizationRecurringExpense } from '../../organization-recurring-expense/organization-recurring-expense.entity';
import { OrganizationPositions } from '../../organization-positions/organization-positions.entity';
import { OrganizationAwards } from '../../organization-awards/organization-awards.entity';
import { OrganizationLanguages } from '../../organization-languages/organization-languages.entity';
import { Email } from '../../email/email.entity';
import { Candidate } from '../../candidate/candidate.entity';
import {
	createDefaultCandidates,
	createRandomCandidates
} from '../../candidate/candidate.seed';
import { CandidateSource } from '../../candidate-source/candidate-source.entity';
import { Tag } from './../../tags/tag.entity';
import { Skill } from './../../skills/skill.entity';
import { Language } from './../../language/language.entity';
import { Tenant } from './../../tenant/tenant.entity';
import { ProductCategory } from '../../product-category/product-category.entity';
import { createDefaultProductCategories } from '../../product-category/product-category.seed';
import { ProductType } from '../../product-type/product-type.entity';
import { CandidateEducation } from '../../candidate-education/candidate-education.entity';
import { createDefaultProductTypes } from '../../product-type/product-type.seed';
import { Product } from '../../product/product.entity';
import { ProductVariant } from '../../product-variant/product-variant.entity';
import { ProductVariantSettings } from '../../product-settings/product-settings.entity';
import { ProductVariantPrice } from '../../product-variant-price/product-variant-price.entity';
import { CandidateSkill } from '../../candidate-skill/candidate-skill.entity';
import {
	createCandidateSources,
	createRandomCandidateSources
} from '../../candidate-source/candidate-source.seed';
import { createDefaultIntegrationTypes } from '../../integration/integration-type.seed';
import { createDefaultIntegrations } from '../../integration/integration.seed';
import { EmployeeAppointment } from '../../employee-appointment/employee-appointment.entity';
import { AppointmentEmployees } from '../../appointment-employees/appointment-employees.entity';
import { ProductOption } from '../../product-option/product-option.entity';
import { HelpCenter } from '../../help-center/help-center.entity';
import { createHelpCenter } from '../../help-center/help-center.seed';
import { createDefaultProducts } from '../../product/product.seed';
import { CandidateDocument } from '../../candidate-documents/candidate-documents.entity';
import { CandidateFeedback } from '../../candidate-feedbacks/candidate-feedbacks.entity';
import {
	createCandidateDocuments,
	createRandomCandidateDocuments
} from '../../candidate-documents/candidate-documents.seed';
import {
	createCandidateFeedbacks,
	createRandomCandidateFeedbacks
} from '../../candidate-feedbacks/candidate-feedbacks.seed';
import { Equipment } from '../../equipment/equipment.entity';
import { Contact } from '../../contact/contact.entity';

import { createRandomTimesheet } from '../../timesheet/timesheet/timesheet.seed';
import { createRandomTask } from '../../tasks/task.seed';
import {
	createDefaultOrganizationProjects,
	createRandomOrganizationProjects
} from '../../organization-projects/organization-projects.seed';

import { RequestApprovalTeam } from '../../request-approval-team/request-approval-team.entity';
import { RequestApproval } from '../../request-approval/request-approval.entity';
import { ApprovalPolicy } from '../../approval-policy/approval-policy.entity';
import { RequestApprovalEmployee } from '../../request-approval-employee/request-approval-employee.entity';
import { ProductTypeTranslation } from '../../product-type/product-type-translation.entity';
import { ProductCategoryTranslation } from '../../product-category/product-category-translation.entity';
import { Payment } from '../../payment/payment.entity';
import { EventType } from '../../event-types/event-type.entity';
import { CandidateInterviewers } from '../../candidate-interviewers/candidate-interviewers.entity';
import { CandidateInterview } from '../../candidate-interview/candidate-interview.entity';
import { CandidateTechnologies } from '../../candidate-technologies/candidate-technologies.entity';
import { CandidatePersonalQualities } from '../../candidate-personal-qualities/candidate-personal-qualities.entity';
import { CandidateCriterionsRating } from '../../candidate-criterions-rating/candidate-criterion-rating.entity';
import { TimeSlotMinute } from '../../timesheet/time-slot-minute.entity';
import { TimeLog } from '../../timesheet/time-log.entity';
import { HelpCenterArticle } from '../../help-center-article/help-center-article.entity';
import { IntegrationType } from '../../integration/integration-type.entity';
import { Integration } from '../../integration/integration.entity';
import { createDefaultTimeFrames } from '../../goal-time-frame/goal-time-frame.seed';
import {
	createDefaultGoals,
	updateDefaultGoalProgress
} from '../../goal/goal.seed';
import {
	createDefaultKeyResults,
	updateDefaultKeyResultProgress
} from '../../keyresult/keyresult.seed';
import { createDefaultKeyResultUpdates } from '../../keyresult-update/keyresult-update.seed';
import {
	seedRandomOrganizationDepartments,
	createDefaultOrganizationDepartments
} from '../../organization-department/organization-department.seed';
import { seedRandomOrganizationPosition } from '../../organization-positions/organization-position.seed';
import {
	createDefaultTags,
	createRandomOrganizationTags,
	createTags
} from '../../tags/tag.seed';
import { createRandomEmailSent } from '../../email/email.seed';
import { createRandomEmployeeInviteSent } from '../../invite/invite.seed';
import { createRandomRequestApproval } from '../../request-approval/request-approval.seed';
import { OrganizationSprint } from '../../organization-sprint/organization-sprint.entity';
import { createRandomEmployeeTimeOff } from '../../time-off-request/time-off-request.seed';
import { createOrganizationDocuments } from '../../organization-documents/organization-documents.seed';
import {
	createDefaultEquipments,
	createRandomEquipments
} from '../../equipment/equipment.seed';
import { createRandomEquipmentSharing } from '../../equipment-sharing/equipment-sharing.seed';
import { createRandomProposals } from '../../proposal/proposal.seed';
import { createRandomInvoiceItem } from '../../invoice-item/invoice-item.seed';
import { createRandomInvoice } from '../../invoice/invoice.seed';
import {
	createCandidateSkills,
	createRandomCandidateSkills
} from '../../candidate-skill/candidate-skill.seed';
import { createRandomCandidateExperience } from '../../candidate-experience/candidate-experience.seed';
import {
	createCandidateEducations,
	createRandomCandidateEducations
} from '../../candidate-education/candidate-education.seed';
import { createRandomContacts } from '../../contact/contact.seed';
import {
	createRandomOrganizationContact,
	createDefaultOrganizationContact
} from '../../organization-contact/organization-contact.seed';
import { createRandomAvailabilitySlots } from '../../availability-slots/availability-slots.seed';
import { createRandomCandidatePersonalQualities } from '../../candidate-personal-qualities/candidate-personal-qualities.seed';
import { createRandomCandidateTechnologies } from '../../candidate-technologies/candidate-technologies.seed';
import { createRandomCandidateInterview } from '../../candidate-interview/candidate-interview.seed';
import { createRandomAwards } from '../../organization-awards/organization-awards.seed';
import { createDefaultGeneralGoalSetting } from '../../goal-general-setting/goal-general-setting.seed';
import { createRandomCandidateCriterionRating } from '../../candidate-criterions-rating/candidate-criterion-rating.seed';
import { createRandomGoalKpi } from '../../goal-kpi/goal-kpi.seed';
import { createRandomEmployeeSetting } from '../../employee-setting/employee-setting.seed';
import { createRandomEmployeeRecurringExpense } from '../../employee-recurring-expense/employee-recurring-expense.seed';
import { createRandomCandidateInterviewers } from '../../candidate-interviewers/candidate-interviewers.seed';
import { createRandomPipelineStage } from '../../pipeline-stage/pipeline-stage.seed';
import { createRandomPipeline } from '../../pipeline/pipeline.seed';
import { createRandomOrganizationRecurringExpense } from '../../organization-recurring-expense/organization-recurring-expense.seed';
import { createRandomHelpCenterAuthor } from '../../help-center-author/help-center-author.seed';
import { createRandomHelpCenterArticle } from '../../help-center-article/help-center-article.seed';
import { createRandomOrganizationLanguage } from '../../organization-languages/organization-languages.seed';
import { createRandomOrganizationSprint } from '../../organization-sprint/organization-sprint.seed';
import { createRandomOrganizationTeamEmployee } from '../../organization-team-employee/organization-team-employee.seed';
import { createRandomAppointmentEmployees } from '../../appointment-employees/appointment-employees.seed';
import { createRandomEmployeeAppointment } from '../../employee-appointment/employee-appointment.seed';
import { createRandomDeal } from '../../deal/deal.seed';
import { createRandomIntegrationSetting } from '../../integration-setting/integration-setting.seed';
import { createRandomIntegrationTenant } from '../../integration-tenant/integration-tenant.seed';

const allEntities = [
	TimeOffPolicy,
	Proposal,
	Invite,
	EmployeeRecurringExpense,
	OrganizationRecurringExpense,
	ExpenseCategory,
	EquipmentSharing,
	User,
	Employee,
	Candidate,
	Role,
	Organization,
	Income,
	Invoice,
	InvoiceItem,
	Expense,
	EmployeeSetting,
	OrganizationTeam,
	OrganizationTeamEmployee,
	OrganizationContact,
	OrganizationVendor,
	OrganizationDepartment,
	OrganizationPositions,
	OrganizationProjects,
	OrganizationAwards,
	OrganizationLanguages,
	OrganizationSprint,
	Task,
	Screenshot,
	Activity,
	TimeSlot,
	Timesheet,
	UserOrganization,
	Country,
	RolePermissions,
	Tenant,
	Email,
	EmailTemplate,
	Tag,
	Skill,
	Language,
	OrganizationEmploymentType,
	Equipment,
	EmployeeLevel,
	ProductCategory,
	AppointmentEmployees,
	EmployeeAppointment,
	ProductType,
	CandidateSource,
	CandidateEducation,
	CandidateSkill,
	CandidateExperience,
	CandidateDocument,
	CandidateFeedback,
	HelpCenter,
	Product,
	ProductVariant,
	ProductVariantSettings,
	ProductVariantPrice,
	ProductOption,
	Contact,
	RequestApprovalTeam,
	RequestApproval,
	ApprovalPolicy,
	RequestApprovalEmployee,
	ProductTypeTranslation,
	ProductCategoryTranslation,
	Payment,
	EventType,
	CandidateInterviewers,
	CandidateInterview,
	CandidateTechnologies,
	CandidatePersonalQualities,
	CandidateCriterionsRating,
	TimeSlotMinute,
	TimeLog,
	HelpCenterArticle,
	IntegrationType,
	Integration
];

const randomSeedConfig = {
	tenants: 5, //The number of random tenants to be seeded.
	organizationsPerTenant: 2, //No of random organizations seeded will be (organizationsPerTenant * tenants)
	employeesPerOrganization: 5, //No of random employees seeded will be (employeesPerOrganization * organizationsPerTenant * tenants)
	candidatesPerOrganization: 2, //No of random employees seeded will be (candidatesPerOrganization * organizationsPerTenant * tenants)
	managersPerOrganization: 2, //No of random manager seeded will be (managersPerOrganization * organizationsPerTenant * tenants)
	dataEntriesPerOrganization: 4, //No of random data entry users seeded will be (dataEntriesPerOrganization * organizationsPerTenant * tenants)
	viewersPerOrganization: 4, //No of random viewers seeded will be (viewersPerOrganization * organizationsPerTenant * tenants)
	projectsPerOrganization: 30, // No of random projects seeded will be  (projectsPerOrganization * organizationsPerTenant * tenants)
	emailsPerOrganization: 30, // No of random emails seeded will be  (emailsPerOrganization * organizationsPerTenant * tenants)
	invitePerOrganization: 30, // No of random emails seeded will be  (emailsPerOrganization * organizationsPerTenant * tenants)
	requestApprovalPerOrganization: 20, // No of random request to approve seeded will be  (requestApprovalPerOrganization * organizationsPerTenant * tenants)
	employeeTimeOffPerOrganization: 10, // No of timeoff request to approve seeded will be  (employeeTimeOffPerOrganization * organizationsPerTenant * tenants)
	equipmentPerTenant: 20, // No of equipmentPerTenant request to approve seeded will be  (equipmentPerTenant * tenants)
	equipmentSharingPerTenant: 20, // No of equipmentSharingPerTenant request to approve seeded will be  (equipmentSharingPerTenant * tenants)
	proposalsSharingPerOrganizations: 30, // No of proposalsSharingPerOrganizations request to approve seeded will be  (proposalsSharingPerOrganizations * tenants * organizations)
	contacts: 50, // The number of random contacts to be seeded.
	noOfHelpCenterArticle: 10, // The number of random Help Center Articles.
	availabilitySlotsPerOrganization: 50 // No of availability slots request to approve seeded will be  (availabilitySlotsPerOrganization * organizationsPerTenant * tenants)
};

@Injectable()
export class SeedDataService {
	connection: Connection;
	log = console.log;
	organizations: Organization[];
	defaultProjects: OrganizationProjects[] | void;
	tenant: Tenant;
	roles: Role[];
	defaultCandidateUsers: User[];
	defaultEmployees: Employee[];

	constructor() {}

	async createConnection() {
		try {
			this.connection = getConnection();
		} catch (error) {
			this.log('DATABASE CONNECTION DOES NOT EXIST');
		}

		if (!this.connection || !this.connection.isConnected) {
			try {
				this.log(chalk.green('🏃‍CONNECTING TO DATABASE...'));

				this.connection = await createConnection({
					...env.database,
					entities: allEntities
				} as ConnectionOptions);
			} catch (error) {
				this.handleError(error, 'Unable to connect to database');
			}
		}
	}

	/**
	 * Use this wrapper function for all seed functions which are not essential.
	 * Essentials seeds are ONLY those which are required to start the UI/login
	 */
	tryExecute<T>(p: Promise<T>): Promise<T> | Promise<void> {
		return (p as any).then(
			(x: T) => x,
			(err: Error) => this.log(err)
		);
	}

	/**
	 * Seed data
	 */
	async run(isDefault: boolean) {
		try {
			// Connect to database
			await this.createConnection();

			// Reset database to start with new, fresh data
			await this.resetDatabase();

			// Seed data with mock / fake data
			await this.seedData(isDefault);

			console.log('Database Seed completed');
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Populate database with mock data
	 */
	async seedData(isDefault: boolean) {
		try {
			this.log(
				chalk.green(
					`🌱 SEEDING ${
						env.production ? 'PRODUCTION' : ''
					} DATABASE...`
				)
			);

			//Seed data which only needs connection

			await this.tryExecute(createDefaultEmailTemplates(this.connection));

			await this.tryExecute(createCountries(this.connection));

			await this.seedBasicDefaultData();

			if (!isDefault) {
				await this.seedDefaultData();
				await this.seedRandomData();
			}

			this.log(
				chalk.green(
					`✅ SEEDED ${env.production ? 'PRODUCTION' : ''} DATABASE`
				)
			);
		} catch (error) {
			this.handleError(error);
		}
	}

	/** Populate Database with Basic Default Data **/
	async seedBasicDefaultData() {
		//Platform level data
		this.tenant = await createDefaultTenants(this.connection);

		this.roles = await createRoles(this.connection, [this.tenant]);

		await createRolePermissions(this.connection, this.roles, [this.tenant]);

		//Tenant level inserts which only need connection, tenant, roles
		const defaultOrganizations = await createDefaultOrganizations(
			this.connection,
			this.tenant
		);

		this.organizations = defaultOrganizations;

		const superAdminUsers = await createDefaultSuperAdminUsers(
			this.connection,
			this.roles,
			this.tenant
		);
		const {
			adminUsers,
			defaultEmployeeUsers,
			defaultCandidateUsers
		} = await createDefaultUsers(this.connection, this.roles, this.tenant);

		this.defaultCandidateUsers = defaultCandidateUsers;

		await createDefaultUsersOrganizations(this.connection, {
			organizations: this.organizations,
			users: [...defaultEmployeeUsers, ...adminUsers, ...superAdminUsers]
		});

		await this.tryExecute(
			createDefaultTimeOffPolicy(this.connection, {
				org: this.organizations[0],
				employees: this.defaultEmployees
			})
		);

		//User level data that needs connection, tenant, organization, role, users
		const defaultEmployees = await createDefaultEmployees(this.connection, {
			tenant: this.tenant,
			org: this.organizations[0],
			users: defaultEmployeeUsers
		});
	}

	/**
	 * Populate default data from env files
	 */
	async seedDefaultData() {
		//Organization level inserts which need connection, tenant, role, organizations
		const categories = await this.tryExecute(
			createExpenseCategories(this.connection, this.organizations)
		);

		await this.tryExecute(
			createEmployeeLevels(this.connection, this.organizations)
		);

		//todo :  Need to fix error of seeding Product Category
		// await this.tryExecute(
		// 	createDefaultProductCategories(
		// 		this.connection,
		//     this.organizations
		// 	)
		// );
		//
		// await this.tryExecute(
		// 	createDefaultProductTypes(this.connection, this.organizations)
		// );

		await this.tryExecute(createRandomContacts(this.connection, 5));

		await this.tryExecute(
			createDefaultOrganizationContact(this.connection)
		);

		this.defaultProjects = await this.tryExecute(
			createDefaultOrganizationProjects(
				this.connection,
				this.organizations
			)
		);

		await this.tryExecute(
			createDefaultOrganizationDepartments(
				this.connection,
				this.organizations
			)
		);

		await this.tryExecute(
			createDefaultProducts(this.connection, this.tenant)
		);

		await this.tryExecute(
			createDefaultTimeFrames(
				this.connection,
				this.tenant,
				this.organizations
			)
		);

		await this.tryExecute(
			createDefaultTags(this.connection, this.tenant, this.organizations)
		);

		await this.tryExecute(
			createDefaultEquipments(this.connection, this.tenant)
		);

		const organizationVendors = await this.tryExecute(
			createOrganizationVendors(this.connection, this.organizations)
		);

		await this.tryExecute(
			createHelpCenter(this.connection, {
				tenant: this.tenant,
				org: this.organizations[0]
			})
		);

		const defaultCandidates = await this.tryExecute(
			createDefaultCandidates(this.connection, {
				tenant: this.tenant,
				org: this.organizations[0],
				users: [...this.defaultCandidateUsers]
			})
		);

		await this.tryExecute(
			createCandidateSources(this.connection, defaultCandidates)
		);

		//Employee level data that need connection, tenant, organization, role, users, employee
		await this.tryExecute(
			createDefaultTeams(
				this.connection,
				this.organizations[0],
				this.defaultEmployees,
				this.roles
			)
		);

		await this.tryExecute(
			createCandidateDocuments(this.connection, defaultCandidates)
		);
		await this.tryExecute(
			createCandidateFeedbacks(this.connection, defaultCandidates)
		);

		await this.tryExecute(
			createCandidateEducations(this.connection, defaultCandidates)
		);

		await this.tryExecute(
			createCandidateSkills(this.connection, defaultCandidates)
		);

		await this.tryExecute(
			createDefaultIncomes(this.connection, {
				org: this.organizations[0],
				employees: this.defaultEmployees
			})
		);

		await this.tryExecute(
			createDefaultExpenses(this.connection, {
				org: this.organizations[0],
				employees: this.defaultEmployees,
				categories,
				organizationVendors
			})
		);

		await this.tryExecute(
			seedDefaultEmploymentTypes(
				this.connection,
				this.defaultEmployees,
				this.organizations[0]
			)
		);

		await this.tryExecute(
			createDefaultGeneralGoalSetting(
				this.connection,
				this.tenant,
				this.organizations
			)
		);

		const goals = await this.tryExecute(
			createDefaultGoals(
				this.connection,
				this.tenant,
				this.organizations,
				this.defaultEmployees
			)
		);

		const keyResults = await this.tryExecute(
			createDefaultKeyResults(
				this.connection,
				this.tenant,
				this.defaultEmployees,
				goals
			)
		);

		await this.tryExecute(
			createDefaultKeyResultUpdates(
				this.connection,
				this.tenant,
				keyResults
			)
		);

		await this.tryExecute(updateDefaultKeyResultProgress(this.connection));

		await this.tryExecute(updateDefaultGoalProgress(this.connection));

		await this.tryExecute(
			createDefaultApprovalPolicyForOrg(this.connection, {
				orgs: this.organizations
			})
		);

		const integrationTypes = await this.tryExecute(
			createDefaultIntegrationTypes(this.connection)
		);
		await this.tryExecute(
			createDefaultIntegrations(this.connection, integrationTypes)
		);
	}

	/**
	 * Populate database with random generated data
	 */
	async seedRandomData() {
		//Platform level data which only need database connection
		const tenants = await createRandomTenants(
			this.connection,
			randomSeedConfig.tenants || 1
		);

		// Independent roles and role permissions for each tenant
		const roles: Role[] = await createRoles(this.connection, tenants);

		await createRolePermissions(this.connection, roles, tenants);

		//Tenant level inserts which only need connection, tenant, role
		const tenantOrganizationsMap = await createRandomOrganizations(
			this.connection,
			tenants,
			randomSeedConfig.organizationsPerTenant || 1
		);

		const tenantSuperAdminsMap = await createRandomSuperAdminUsers(
			this.connection,
			roles,
			tenants,
			1
		);

		const tenantUsersMap = await createRandomUsers(
			this.connection,
			roles,
			tenants,
			randomSeedConfig.organizationsPerTenant || 1,
			randomSeedConfig.employeesPerOrganization || 1,
			randomSeedConfig.candidatesPerOrganization || 1,
			randomSeedConfig.managersPerOrganization || 1,
			randomSeedConfig.dataEntriesPerOrganization || 1,
			randomSeedConfig.viewersPerOrganization || 1
		);

		//Organization level inserts which need connection, tenant, organizations, users
		await createRandomUsersOrganizations(
			this.connection,
			tenants,
			tenantOrganizationsMap,
			tenantSuperAdminsMap,
			tenantUsersMap,
			randomSeedConfig.employeesPerOrganization || 1
		);

		const tenantEmployeeMap = await createRandomEmployees(
			this.connection,
			tenants,
			tenantOrganizationsMap,
			tenantUsersMap,
			randomSeedConfig.employeesPerOrganization || 1
		);

		const tenantCandidatesMap = await this.tryExecute(
			createRandomCandidates(
				this.connection,
				tenants,
				tenantOrganizationsMap,
				tenantUsersMap,
				randomSeedConfig.candidatesPerOrganization || 1
			)
		);

		await this.tryExecute(
			createRandomCandidateSources(
				this.connection,
				tenants,
				tenantCandidatesMap
			)
		);

		await this.tryExecute(
			createRandomIncomes(this.connection, tenants, tenantEmployeeMap)
		);

		await this.tryExecute(
			createRandomTeam(
				this.connection,
				tenants,
				tenantEmployeeMap,
				tenantOrganizationsMap,
				roles
			)
		);

		await this.tryExecute(
			createRandomCandidateDocuments(
				this.connection,
				tenants,
				tenantCandidatesMap
			)
		);

		await this.tryExecute(
			createRandomCandidateFeedbacks(
				this.connection,
				tenants,
				tenantCandidatesMap
			)
		);

		await this.tryExecute(
			createRandomCandidateEducations(
				this.connection,
				tenants,
				tenantCandidatesMap
			)
		);

		await this.tryExecute(
			createRandomCandidateExperience(
				this.connection,
				tenants,
				tenantCandidatesMap
			)
		);

		await this.tryExecute(
			createRandomCandidateSkills(
				this.connection,
				tenants,
				tenantCandidatesMap
			)
		);

		const organizationVendorsMap = await this.tryExecute(
			createRandomOrganizationVendors(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			createRandomTimeOffPolicies(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		const categoriesMap = await this.tryExecute(
			createRandomExpenseCategories(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			createRandomExpenses(
				this.connection,
				tenants,
				tenantEmployeeMap,
				organizationVendorsMap,
				categoriesMap
			)
		);

		await this.tryExecute(
			createRandomContacts(
				this.connection,
				randomSeedConfig.contacts || 10
			)
		);

		await this.tryExecute(
			createRandomEquipments(
				this.connection,
				tenants,
				randomSeedConfig.equipmentPerTenant || 20
			)
		);

		await this.tryExecute(
			createRandomEquipmentSharing(
				this.connection,
				tenants,
				tenantEmployeeMap,
				randomSeedConfig.equipmentSharingPerTenant || 20
			)
		);

		await this.tryExecute(
			seedRandomEmploymentTypes(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			seedRandomOrganizationDepartments(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			createRandomEmployeeInviteSent(
				this.connection,
				tenants,
				tenantOrganizationsMap,
				tenantSuperAdminsMap,
				randomSeedConfig.invitePerOrganization || 20
			)
		);

		await this.tryExecute(
			seedRandomOrganizationPosition(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			createRandomApprovalPolicyForOrg(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			createRandomRequestApproval(
				this.connection,
				tenants,
				tenantEmployeeMap,
				randomSeedConfig.requestApprovalPerOrganization || 20
			)
		);

		await this.tryExecute(createSkills(this.connection));
		await this.tryExecute(createLanguages(this.connection));
		await this.tryExecute(createTags(this.connection));

		const tags = await this.tryExecute(
			createRandomOrganizationTags(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			createRandomOrganizationProjects(
				this.connection,
				tenants,
				tenantOrganizationsMap,
				tags,
				randomSeedConfig.projectsPerOrganization || 10
			)
		);

		await this.tryExecute(
			createRandomEmployeeTimeOff(
				this.connection,
				tenants,
				tenantOrganizationsMap,
				tenantEmployeeMap,
				randomSeedConfig.employeeTimeOffPerOrganization || 20
			)
		);

		await this.tryExecute(
			createOrganizationDocuments(this.connection, this.organizations)
		);

		await this.tryExecute(
			createRandomProposals(
				this.connection,
				tenants,
				tenantEmployeeMap,
				tenantOrganizationsMap,
				randomSeedConfig.proposalsSharingPerOrganizations || 30
			)
		);

		await this.tryExecute(
			createRandomEmailSent(
				this.connection,
				tenants,
				tenantOrganizationsMap,
				randomSeedConfig.emailsPerOrganization || 20
			)
		);

		await this.tryExecute(
			createRandomTask(this.connection, this.defaultProjects)
		);
		await this.tryExecute(
			createRandomTimesheet(this.connection, this.defaultProjects)
		);

		await this.tryExecute(
			createRandomOrganizationContact(
				this.connection,
				tenants,
				tenantEmployeeMap,
				tenantOrganizationsMap,
				10
			)
		);

		await this.tryExecute(
			createRandomInvoice(
				this.connection,
				tenants,
				tenantOrganizationsMap,
				50
			)
		);

		await this.tryExecute(
			createRandomAvailabilitySlots(
				this.connection,
				tenants,
				tenantOrganizationsMap,
				tenantEmployeeMap,
				randomSeedConfig.availabilitySlotsPerOrganization || 20
			)
		);

		await this.tryExecute(
			createRandomInvoiceItem(
				this.connection,
				tenants,
				tenantOrganizationsMap,
				tenantEmployeeMap
			)
		);

		await this.tryExecute(
			createRandomCandidateEducations(
				this.connection,
				tenants,
				tenantCandidatesMap
			)
		);

		await this.tryExecute(
			createRandomCandidateExperience(
				this.connection,
				tenants,
				tenantCandidatesMap
			)
		);

		await this.tryExecute(
			createRandomCandidateSkills(
				this.connection,
				tenants,
				tenantCandidatesMap
			)
		);

		await this.tryExecute(
			createRandomCandidateInterview(
				this.connection,
				tenants,
				tenantCandidatesMap
			)
		);

		await this.tryExecute(
			createRandomCandidateTechnologies(
				this.connection,
				tenants,
				tenantCandidatesMap
			)
		);

		await this.tryExecute(
			createRandomCandidatePersonalQualities(
				this.connection,
				tenants,
				tenantCandidatesMap
			)
		);

		await this.tryExecute(
			createRandomAwards(this.connection, tenants, tenantOrganizationsMap)
		);

		await this.tryExecute(
			createRandomCandidateEducations(
				this.connection,
				tenants,
				tenantCandidatesMap
			)
		);

		await this.tryExecute(
			createRandomCandidateInterviewers(
				this.connection,
				tenants,
				tenantEmployeeMap,
				tenantCandidatesMap
			)
		);

		await this.tryExecute(
			createRandomEmployeeRecurringExpense(
				this.connection,
				tenants,
				tenantEmployeeMap
			)
		);

		await this.tryExecute(
			createRandomEmployeeSetting(
				this.connection,
				tenants,
				tenantEmployeeMap
			)
		);

		await this.tryExecute(
			createRandomGoalKpi(
				this.connection,
				tenants,
				tenantOrganizationsMap,
				tenantEmployeeMap
			)
		);

		await this.tryExecute(
			createRandomPipeline(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			createRandomPipelineStage(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			createRandomOrganizationLanguage(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			createRandomOrganizationRecurringExpense(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			createRandomHelpCenterArticle(
				this.connection,
				randomSeedConfig.noOfHelpCenterArticle || 5
			)
		);

		await this.tryExecute(
			createRandomOrganizationSprint(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			createRandomOrganizationTeamEmployee(
				this.connection,
				tenants,
				tenantEmployeeMap,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			createRandomHelpCenterAuthor(
				this.connection,
				tenants,
				tenantEmployeeMap
			)
		);

		await this.tryExecute(
			createRandomAppointmentEmployees(
				this.connection,
				tenants,
				tenantEmployeeMap
			)
		);

		await this.tryExecute(
			createRandomEmployeeAppointment(
				this.connection,
				tenants,
				tenantEmployeeMap,
				tenantOrganizationsMap
			)
		);
		await this.tryExecute(
			createRandomDeal(
				this.connection,
				tenants,
				tenantEmployeeMap,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			createRandomIntegrationTenant(this.connection, tenants)
		);
		await this.tryExecute(
			createRandomIntegrationSetting(this.connection, tenants)
		);

		await this.tryExecute(
			createRandomCandidateCriterionRating(
				this.connection,
				tenants,
				tenantCandidatesMap
			)
		);
	}

	/**
	 * Retrieve entities metadata
	 */
	async getEntities() {
		const entities = [];
		try {
			this.connection.entityMetadatas.forEach((entity) =>
				entities.push({
					name: entity.name,
					tableName: entity.tableName
				})
			);
			return entities;
		} catch (error) {
			this.handleError(error, 'Unable to retrieve database metadata');
		}
	}

	/**
	 * Cleans all the entities
	 * Removes all data from database
	 */
	async cleanAll(entities) {
		try {
			for (const entity of entities) {
				const repository = getRepository(entity.name);
				await repository.query(
					`TRUNCATE  "${entity.tableName}" RESTART IDENTITY CASCADE;`
				);
			}
		} catch (error) {
			this.handleError(error, 'Unable to clean database');
		}
	}

	/**
	 * Reset the database, truncate all tables (remove all data)
	 */
	async resetDatabase() {
		const entities = await this.getEntities();
		await this.cleanAll(entities);
		//await loadAll(entities);
		this.log(chalk.green(`✅ RESET DATABASE SUCCESSFUL`));
	}

	private handleError(error: Error, message?: string): void {
		this.log(
			chalk.bgRed(
				`🛑 ERROR: ${!!message ? message : 'Unable to seed database'}`
			)
		);
		throw error;
	}
}
