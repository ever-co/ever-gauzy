import { IBasePerTenantEntityModel } from './base-entity.model';
import {
	ITenant,
	ITag,
	ISkill,
	IOrganizationSprint,
	IEmployee,
	IOrganizationAwards
} from '@gauzy/models';
import { IContact } from './contact.model';
import { IOrganizationLanguages } from './organization-languages.model';

export enum OrganizationPermissionsEnum {
	ALLOW_MANUAL_TIME = 'allowManualTime',
	ALLOW_MODIFY_TIME = 'allowModifyTime',
	ALLOW_DELETE_TIME = 'allowDeleteTime',
	ALLOW_FUTURE_DATE = 'futureDateAllowed'
}

export enum ListsInputTypeEnum {
	DEPARTMENTS = 'DEPARTMENTS',
	POSITIONS = 'POSITIONS',
	VENDORS = 'VENDORS'
}
export interface IOrganization extends IBasePerTenantEntityModel {
	name: string;
	profile_link: string;
	valueDate?: Date;
	totalEmployees: number;
	status?: string;
	// Organization logo Url
	imageUrl?: string;
	banner: string;
	short_description: string;
	client_focus: string;
	show_income?: boolean;
	show_profits?: boolean;
	show_bonuses_paid?: boolean;
	show_total_hours?: boolean;
	show_minimum_project_size?: boolean;
	show_projects_count?: boolean;
	show_clients_count?: boolean;
	show_employees_count?: boolean;
	overview: string;
	skills: ISkill[];
	currency: string;
	isActive: boolean;
	defaultValueDateType: string;
	defaultAlignmentType?: string;
	dateFormat?: string;
	brandColor?: string;
	timeZone?: string;
	officialName?: string;
	startWeekOn?: string;
	taxId?: string;
	numberFormat?: string;
	bonusType?: string;
	bonusPercentage?: number;
	employees?: IEmployee[];
	invitesAllowed?: boolean;
	inviteExpiryPeriod?: number;
	tags: ITag[];
	futureDateAllowed?: boolean;
	allowManualTime?: boolean;
	allowModifyTime?: boolean;
	allowDeleteTime?: boolean;
	regionCode?: string;
	requireReason?: boolean;
	requireDescription?: boolean;
	requireProject?: boolean;
	requireTask?: boolean;
	requireClient?: boolean;
	timeFormat?: 12 | 24;
	defaultStartTime?: string;
	defaultEndTime?: string;
	registrationDate?: Date;
	contact: IContact;
	separateInvoiceItemTaxAndDiscount?: boolean;
	organizationSprints?: IOrganizationSprint[];
	minimumProjectSize?: string;
	show_clients?: boolean;
	// "left" and "right" values, used to know where to put currency symbol relative to amount
	currencyPosition?: string;
	website?: string;
	// used in invoice headers to display organization details
	fiscalInformation?: string;
	fiscalStartDate?: Date;
	fiscalEndDate?: Date;
	discountAfterTax?: boolean;
	awards?: IOrganizationAwards[];
	languages?: IOrganizationLanguages[];
}

export interface IOrganizationFindInput {
	id?: string;
	tenantId?: string;
	name?: string;
	profile_link?: string;
	valueDate?: Date;
	imageUrl?: string;
	currency?: CurrenciesEnum;
	isActive?: boolean;
	skills?: ISkill[];
	tags?: ITag[];
}

export interface IOrganizationCreateInput extends IContact {
	name: string;
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
}

export interface IOrganizationUpdateInput extends IOrganizationCreateInput {
	gauzyId?: string;
}

export enum OrganizationSelectInput {
	id = 'id',
	name = 'name',
	profile_link = 'profile_link',
	valueDate = 'valueDate',
	imageUrl = 'imageUrl',
	currency = 'currency',
	createdAt = 'createdAt',
	updatedAt = 'updatedAt',
	isActive = 'isActive',
	tags = 'tags'
}

export enum RegionsEnum {
	'EN' = 'English (United States)',
	'BG' = 'Bulgarian (Bulgaria)',
	'HE' = 'Hebrew (Israel)',
	'RU' = 'Rusian (Russia)'
}

export enum CurrenciesEnum {
	AFN = 'AFN',
	AFA = 'AFA',
	ALL = 'ALL',
	ALK = 'ALK',
	DZD = 'DZD',
	ADP = 'ADP',
	AOA = 'AOA',
	AOK = 'AOK',
	AON = 'AON',
	AOR = 'AOR',
	ARA = 'ARA',
	ARS = 'ARS',
	ARM = 'ARM',
	ARP = 'ARP',
	ARL = 'ARL',
	AMD = 'AMD',
	AWG = 'AWG',
	AUD = 'AUD',
	ATS = 'ATS',
	AZN = 'AZN',
	AZM = 'AZM',
	BSD = 'BSD',
	BHD = 'BHD',
	BDT = 'BDT',
	BBD = 'BBD',
	BYN = 'BYN',
	BYB = 'BYB',
	BYR = 'BYR',
	BEF = 'BEF',
	BEC = 'BEC',
	BEL = 'BEL',
	BZD = 'BZD',
	BMD = 'BMD',
	BTN = 'BTN',
	BOB = 'BOB',
	BOL = 'BOL',
	BOV = 'BOV',
	BOP = 'BOP',
	BAM = 'BAM',
	BAD = 'BAD',
	BAN = 'BAN',
	BWP = 'BWP',
	BRC = 'BRC',
	BRZ = 'BRZ',
	BRE = 'BRE',
	BRR = 'BRR',
	BRN = 'BRN',
	BRB = 'BRB',
	BRL = 'BRL',
	GBP = 'GBP',
	BND = 'BND',
	BGL = 'BGL',
	BGN = 'BGN',
	BGO = 'BGO',
	BGM = 'BGM',
	BUK = 'BUK',
	BIF = 'BIF',
	XPF = 'XPF',
	KHR = 'KHR',
	CAD = 'CAD',
	CVE = 'CVE',
	KYD = 'KYD',
	XAF = 'XAF',
	CLE = 'CLE',
	CLP = 'CLP',
	CLF = 'CLF',
	CNX = 'CNX',
	CNY = 'CNY',
	COP = 'COP',
	COU = 'COU',
	KMF = 'KMF',
	CDF = 'CDF',
	CRC = 'CRC',
	HRD = 'HRD',
	HRK = 'HRK',
	CUC = 'CUC',
	CUP = 'CUP',
	CYP = 'CYP',
	CZK = 'CZK',
	CSK = 'CSK',
	DKK = 'DKK',
	DJF = 'DJF',
	DOP = 'DOP',
	NLG = 'NLG',
	XCD = 'XCD',
	DDM = 'DDM',
	ECS = 'ECS',
	ECV = 'ECV',
	EGP = 'EGP',
	GQE = 'GQE',
	ERN = 'ERN',
	EEK = 'EEK',
	ETB = 'ETB',
	EUR = 'EUR',
	XEU = 'XEU',
	FKP = 'FKP',
	FJD = 'FJD',
	FIM = 'FIM',
	FRF = 'FRF',
	XFO = 'XFO',
	XFU = 'XFU',
	GMD = 'GMD',
	GEK = 'GEK',
	GEL = 'GEL',
	DEM = 'DEM',
	GHS = 'GHS',
	GHC = 'GHC',
	GIP = 'GIP',
	GRD = 'GRD',
	GTQ = 'GTQ',
	GWP = 'GWP',
	GNF = 'GNF',
	GNS = 'GNS',
	GYD = 'GYD',
	HTG = 'HTG',
	HNL = 'HNL',
	HKD = 'HKD',
	HUF = 'HUF',
	ISK = 'ISK',
	ISJ = 'ISJ',
	INR = 'INR',
	IDR = 'IDR',
	IRR = 'IRR',
	IQD = 'IQD',
	IEP = 'IEP',
	ILS = 'ILS',
	ILP = 'ILP',
	ILR = 'ILR',
	ITL = 'ITL',
	JMD = 'JMD',
	JPY = 'JPY',
	JOD = 'JOD',
	KZT = 'KZT',
	KES = 'KES',
	KWD = 'KWD',
	KGS = 'KGS',
	LAK = 'LAK',
	LVL = 'LVL',
	LVR = 'LVR',
	LBP = 'LBP',
	LSL = 'LSL',
	LRD = 'LRD',
	LYD = 'LYD',
	LTL = 'LTL',
	LTT = 'LTT',
	LUL = 'LUL',
	LUC = 'LUC',
	LUF = 'LUF',
	MOP = 'MOP',
	MKD = 'MKD',
	MKN = 'MKN',
	MGA = 'MGA',
	MGF = 'MGF',
	MWK = 'MWK',
	MYR = 'MYR',
	MVR = 'MVR',
	MVP = 'MVP',
	MLF = 'MLF',
	MTL = 'MTL',
	MTP = 'MTP',
	MRO = 'MRO',
	MUR = 'MUR',
	MXV = 'MXV',
	MXN = 'MXN',
	MXP = 'MXP',
	MDC = 'MDC',
	MDL = 'MDL',
	MCF = 'MCF',
	MNT = 'MNT',
	MAD = 'MAD',
	MAF = 'MAF',
	MZE = 'MZE',
	MZN = 'MZN',
	MZM = 'MZM',
	MMK = 'MMK',
	NAD = 'NAD',
	NPR = 'NPR',
	ANG = 'ANG',
	TWD = 'TWD',
	NZD = 'NZD',
	NIO = 'NIO',
	NIC = 'NIC',
	NGN = 'NGN',
	KPW = 'KPW',
	NOK = 'NOK',
	OMR = 'OMR',
	PKR = 'PKR',
	PAB = 'PAB',
	PGK = 'PGK',
	PYG = 'PYG',
	PEI = 'PEI',
	PEN = 'PEN',
	PES = 'PES',
	PHP = 'PHP',
	PLN = 'PLN',
	PLZ = 'PLZ',
	PTE = 'PTE',
	GWE = 'GWE',
	QAR = 'QAR',
	XRE = 'XRE',
	RHD = 'RHD',
	RON = 'RON',
	ROL = 'ROL',
	RUB = 'RUB',
	RUR = 'RUR',
	RWF = 'RWF',
	SVC = 'SVC',
	WST = 'WST',
	SAR = 'SAR',
	RSD = 'RSD',
	CSD = 'CSD',
	SCR = 'SCR',
	SLL = 'SLL',
	SGD = 'SGD',
	SKK = 'SKK',
	SIT = 'SIT',
	SBD = 'SBD',
	SOS = 'SOS',
	ZAR = 'ZAR',
	ZAL = 'ZAL',
	KRH = 'KRH',
	KRW = 'KRW',
	KRO = 'KRO',
	SSP = 'SSP',
	SUR = 'SUR',
	ESP = 'ESP',
	ESA = 'ESA',
	ESB = 'ESB',
	LKR = 'LKR',
	SHP = 'SHP',
	SDD = 'SDD',
	SDG = 'SDG',
	SDP = 'SDP',
	SRD = 'SRD',
	SRG = 'SRG',
	SZL = 'SZL',
	SEK = 'SEK',
	CHF = 'CHF',
	SYP = 'SYP',
	STD = 'STD',
	TJR = 'TJR',
	TJS = 'TJS',
	TZS = 'TZS',
	THB = 'THB',
	TPE = 'TPE',
	TOP = 'TOP',
	TTD = 'TTD',
	TND = 'TND',
	TRY = 'TRY',
	TRL = 'TRL',
	TMT = 'TMT',
	TMM = 'TMM',
	USD = 'USD',
	USN = 'USN',
	USS = 'USS',
	UGX = 'UGX',
	UGS = 'UGS',
	UAH = 'UAH',
	UAK = 'UAK',
	AED = 'AED',
	UYU = 'UYU',
	UYP = 'UYP',
	UYI = 'UYI',
	UZS = 'UZS',
	VUV = 'VUV',
	VEF = 'VEF',
	VEB = 'VEB',
	VND = 'VND',
	VNN = 'VNN',
	CHE = 'CHE',
	CHW = 'CHW',
	XOF = 'XOF',
	YDD = 'YDD',
	YER = 'YER',
	YUN = 'YUN',
	YUD = 'YUD',
	YUM = 'YUM',
	YUR = 'YUR',
	ZRN = 'ZRN',
	ZRZ = 'ZRZ',
	ZMW = 'ZMW',
	ZMK = 'ZMK',
	ZWD = 'ZWD',
	ZWR = 'ZWR',
	ZWL = 'ZWL'
}

export enum DefaultValueDateTypeEnum {
	TODAY = 'TODAY',
	END_OF_MONTH = 'END_OF_MONTH',
	START_OF_MONTH = 'START_OF_MONTH'
}

export enum ProjectBillingEnum {
	RATE = 'RATE',
	FLAT_FEE = 'FLAT_FEE',
	MILESTONES = 'MILESTONES'
}

export enum AlignmentOptions {
	LEFT = 'LEFT',
	RIGHT = 'RIGHT',
	CENTER = 'CENTER'
}

export enum CurrencyPosition {
	LEFT = 'LEFT',
	RIGHT = 'RIGHT'
}

export enum WeekDaysEnum {
	MONDAY = 'MONDAY',
	TUESDAY = 'TUESDAY',
	WEDNESDAY = 'WEDNESDAY',
	THURSDAY = 'THURSDAY',
	FRIDAY = 'FRIDAY',
	SATURDAY = 'SATURDAY',
	SUNDAY = 'SUNDAY'
}

export enum BonusTypeEnum {
	PROFIT_BASED_BONUS = 'PROFIT_BASED_BONUS',
	REVENUE_BASED_BONUS = 'REVENUE_BASED_BONUS'
}

export enum ClientFocusEnum {
	VERY_SMALL_BUSINESSES = 'Very Small Businesses',
	SMALL_BUSINESSES = 'Small Businesses',
	MEDIUM_BUSINESSES = 'Medium Businesses',
	LARGE_BUSINESSES = 'Large Businesses'
}

export enum ProjectOwnerEnum {
	CLIENT = 'CLIENT',
	INTERNAL = 'INTERNAL'
}

export enum MinimumProjectSizeEnum {
	ONE_THOUSAND = '1000+',
	FIVE_THOUSAND = '5000+',
	TEN_THOUSAND = '10000+',
	TWENTY_FIVE_THOUSAND = '25000+',
	FIFTY_THOUSAND = '50000+',
	ONE_HUNDRED_THOUSAND = '100000+'
}

export const DEFAULT_PROFIT_BASED_BONUS = 75;
export const DEFAULT_REVENUE_BASED_BONUS = 10;
