import { BonusTypeEnum, CurrenciesEnum, DefaultValueDateTypeEnum, IAccountingTemplate, ICandidate, IContact, IEmployee, IOrganization, IOrganizationContact, IOrganizationCreateInput, ISkill, ITag, ITenant } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";

export class CreateOrganizationDto implements IOrganizationCreateInput {

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    name: string;

    isDefault: boolean;
    profile_link: string;
    valueDate?: Date;
    imageUrl: string;
    currency: CurrenciesEnum;
    client_focus: string;
    show_income?: boolean;
    show_profits?: boolean;
    show_bonuses_paid?: boolean;
    show_total_hours?: boolean;
    show_minimum_project_size?: boolean;
    show_projects_count?: boolean;
    show_clients_count?: boolean;
    show_employees_count?: boolean;
    defaultValueDateType: DefaultValueDateTypeEnum;
    dateFormat?: string;
    timeZone?: string;
    officialName?: string;
    startWeekOn?: string;
    taxId?: string;
    numberFormat?: string;
    bonusType: BonusTypeEnum;
    bonusPercentage?: number;
    invitesAllowed?: boolean;
    inviteExpiryPeriod?: number;
    tags?: ITag[];
    tenant: ITenant;
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
    id?: string;
    firstName?: string;
    lastName?: string;
    country?: string;
    city?: string;
    address?: string;
    address2?: string;
    postcode?: string;
    latitude?: number;
    longitude?: number;
    regionCode?: string;
    fax?: string;
    organization_contacts?: IOrganizationContact[];
    employees?: IEmployee[];
    candidates?: ICandidate[];
    organizationId?: string;
    organization?: IOrganization;
    tenantId?: string;
    createdAt?: Date;
    updatedAt?: Date;
    
}