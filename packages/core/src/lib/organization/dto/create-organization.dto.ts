import { ApiProperty, IntersectionType, PickType } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import {
	CurrenciesEnum,
	IAccountingTemplate,
	ICandidate,
	IContact,
	IEmployee,
	IImageAsset,
	IOrganization,
	IOrganizationContact,
	IOrganizationCreateInput,
	ISkill,
	ITenant,
	IUser
} from '@gauzy/contracts';
import { Organization } from './../organization.entity';
import { OrganizationBonusesDTO } from './organization-bonuses.dto';
import { OrganizationSettingDTO } from './organization-setting.dto';
import { RelationalTagDTO } from './../../tags/dto';

/**
 * Organization Create DTO validation
 *
 */
export class CreateOrganizationDTO
	extends IntersectionType(
		OrganizationBonusesDTO,
		OrganizationSettingDTO,
		PickType(Organization, ['name', 'imageId', 'standardWorkHoursPerDay'] as const),
		PickType(Organization, ['upworkOrganizationId', 'upworkOrganizationName'] as const),
		RelationalTagDTO
	)
	implements IOrganizationCreateInput
{
	isDefault?: boolean;
	profile_link?: string;
	valueDate?: Date;
	totalEmployees?: number;
	imageUrl?: string;
	client_focus?: string;
	show_income?: boolean;
	show_profits?: boolean;
	show_bonuses_paid?: boolean;
	show_total_hours?: boolean;
	show_minimum_project_size?: boolean;
	show_projects_count?: boolean;
	show_clients_count?: boolean;
	show_employees_count?: boolean;
	dateFormat?: string;
	timeZone?: string;
	officialName?: string;
	taxId?: string;
	numberFormat?: string;
	invitesAllowed?: boolean;
	futureDateAllowed?: boolean;
	tenant?: ITenant;
	contact?: IContact;
	skills?: ISkill[];
	minimumProjectSize?: string;
	show_clients?: boolean;
	website?: string;
	fiscalInformation?: string;
	defaultInvoiceEstimateTerms?: string;
	convertAcceptedEstimates?: boolean;
	daysUntilDue?: number;
	accountingTemplates?: IAccountingTemplate[];
	isImporting?: boolean;
	sourceId?: string;
	userOrganizationSourceId?: string;
	firstName?: string;
	lastName?: string;
	country?: string;
	city?: string;
	address?: string;
	address2?: string;
	postcode?: string;
	latitude?: number;
	longitude?: number;
	fax?: string;
	organization_contacts?: IOrganizationContact[];
	employees?: IEmployee[];
	candidates?: ICandidate[];
	organizationId?: string;
	organization?: IOrganization;
	tenantId?: string;
	id?: string;
	createdAt?: Date;
	updatedAt?: Date;
	isActive?: boolean;
	isArchived?: boolean;
	archivedAt?: Date;
	createdByUser?: IUser;
	createdByUserId?: string;
	updatedByUser?: IUser;
	updatedByUserId?: string;
	deletedByUser?: IUser;
	deletedByUserId?: string;
	deletedAt?: Date;
	registerAsEmployee?: boolean;
	startedWorkOn?: Date;
	image?: IImageAsset;
	@ApiProperty({
		enum: CurrenciesEnum,
		example: CurrenciesEnum.USD,
		required: true
	})
	@IsNotEmpty()
	@IsEnum(CurrenciesEnum)
	readonly currency: CurrenciesEnum;
}
