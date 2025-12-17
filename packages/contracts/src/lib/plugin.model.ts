/**
 * Base interface for tenant and organization-scoped entities
 */
import { IBaseEntityModel, IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IEmployee } from './employee.model';
import { IPayment } from './payment.model';
import { IRole } from './role.model';
import { ITag } from './tag.model';
import { IUser } from './user.model';

export enum PluginScope {
	TENANT = 'tenant',
	ORGANIZATION = 'organization',
	USER = 'user'
}

export enum PluginSettingDataType {
	STRING = 'string',
	NUMBER = 'number',
	BOOLEAN = 'boolean',
	JSON = 'json',
	FILE = 'file'
}

/**
 * Defines the possible states of a plugin
 */
export enum PluginStatus {
	ACTIVE = 'ACTIVE', // Plugin is available for use
	INACTIVE = 'INACTIVE', // Plugin is not available for use
	DEPRECATED = 'DEPRECATED', // Plugin is supported but will be removed in future
	ARCHIVED = 'ARCHIVED' // Plugin is no longer available for new installations
}

/**
 * Defines the supported platform targets for plugins
 */
export enum PluginType {
	DESKTOP = 'DESKTOP', // Native desktop application plugin
	WEB = 'WEB', // Browser-based plugin
	MOBILE = 'MOBILE' // Added mobile support
}

export enum PluginSourceType {
	CDN = 'CDN',
	NPM = 'NPM',
	GAUZY = 'GAUZY'
}

export enum PluginOSType {
	LINUX = 'LINUX',
	MAC = 'MAC',
	WINDOWS = 'WINDOWS',
	UNIVERSAL = 'UNIVERSAL'
}

export enum PluginOSArch {
	X64 = 'X64',
	ARM = 'ARM'
}

/**
 * Enum for plugin billing status
 */
export enum PluginBillingStatus {
	PENDING = 'pending',
	PROCESSED = 'processed',
	PAID = 'paid',
	OVERDUE = 'overdue',
	FAILED = 'failed',
	CANCELLED = 'cancelled',
	REFUNDED = 'refunded',
	PARTIALLY_PAID = 'partially_paid'
}

/**
 * Plugin subscription information
 */
export interface IPluginSubscription extends IBasePerTenantAndOrganizationEntityModel {
	// Subscription status
	status: PluginSubscriptionStatus;

	// Subscription scope (tenant, organization, user)
	scope: PluginScope;

	// Start date of subscription
	startDate: Date;

	// End date of subscription (null for active subscriptions)
	endDate?: Date;

	// Trial period end date (if applicable)
	trialEndDate?: Date;

	// Whether auto-renewal is enabled
	autoRenew: boolean;

	// External subscription ID from payment provider
	externalSubscriptionId?: string;

	// Cancellation date (if cancelled)
	cancelledAt?: Date;

	// Cancellation reason
	cancellationReason?: string;

	// The plugin this subscription is for
	plugin: IPlugin;
	pluginId: ID;

	// The plugin tenant relationship
	pluginTenant: IPluginTenant;
	pluginTenantId: ID;

	// User who subscribed (for user-level subscriptions)
	subscriber?: IUser;
	subscriberId?: ID;

	// Subscription metadata for additional data
	metadata?: Record<string, any>;

	// Subscription plan (if subscription is based on a specific plan)
	plan?: IPluginSubscriptionPlan;
	planId?: ID;

	// Parent-child subscription relationships for hierarchical management
	parent?: IPluginSubscription;
	parentId?: ID;
	children?: IPluginSubscription[];

	// Billing records for this subscription
	billings?: IPluginBilling[];

	// Payment records for this subscription (when payment system is implemented)
	payments?: IPayment[];
}

export interface IPluginSubscriptionPlan extends IBaseEntityModel {
	// Plan name
	name: string;

	// Plan description
	description?: string;

	// Subscription type/plan level
	type: PluginSubscriptionType;

	// Plan price
	price: number;

	// Currency code (e.g., USD, EUR)
	currency: string;

	// Billing period
	billingPeriod: PluginBillingPeriod;

	// Plan features list
	features: string[];

	// Plan limitations and quotas
	limitations?: Record<string, any>;

	// Whether the plan is active and available for purchase
	isActive: boolean;

	// Whether this plan is marked as popular
	isPopular?: boolean;

	// Whether this plan is recommended
	isRecommended?: boolean;

	// Trial period duration in days
	trialDays?: number;

	// Setup fee for the plan
	setupFee?: number;

	// Discount percentage for the plan
	discountPercentage?: number;

	// Plan metadata
	metadata?: Record<string, any>;

	// Sort order for displaying plans
	sortOrder?: number;

	// The plugin this plan belongs to
	plugin?: IPlugin;
	pluginId: ID;

	// User who created this plan
	createdBy?: IUser;
	createdById?: ID;

	// Subscriptions using this plan
	subscriptions?: IPluginSubscription[];
}

export interface IPluginSetting extends IBasePerTenantAndOrganizationEntityModel {
	// Setting key/name
	key: string;

	// Setting value
	value: string;

	// Data type of the setting
	dataType: PluginSettingDataType;

	// Default value for the setting
	defaultValue?: string;

	// Whether the setting is required
	isRequired: boolean;

	// Whether the setting is encrypted/sensitive
	isEncrypted: boolean;

	// Setting description/help text
	description?: string;

	// Display order for UI
	order?: number;

	// The plugin this setting belongs to
	plugin: IPlugin;

	// Foreign key to the plugin
	pluginId: ID;

	// Optional plugin tenant relationship for tenant-specific settings
	pluginTenant?: IPluginTenant;

	// Foreign key to the plugin tenant
	pluginTenantId?: string;

	// Plugin Category relationship (for default category settings)
	category?: IPluginCategory;

	// Foreign key to the category
	categoryId?: string;
}

export interface IPluginBilling extends IBasePerTenantAndOrganizationEntityModel {
	// Associated subscription
	subscription: IPluginSubscription;
	subscriptionId: ID;

	// Billing amount
	amount: number;

	// Currency code
	currency: string;

	// Billing date
	billingDate: Date;

	// Due date for payment
	dueDate: Date;

	// Billing status
	status: PluginBillingStatus;

	// Billing period information
	billingPeriod: PluginBillingPeriod;
	billingPeriodStart: Date;
	billingPeriodEnd: Date;

	// Billing description/notes
	description?: string;

	// Billing metadata
	metadata?: Record<string, any>;
}

export interface IPluginPayment extends IBasePerTenantAndOrganizationEntityModel {
	subscriptionId: string;
	billingId?: string;
	amount: number;
	currency: string;
	status: PaymentStatus;
	paymentMethod: PaymentMethod;
	transactionId: string;
	gatewayResponse?: Record<string, any>;
	processedAt: Date;
	refundedAt?: Date;
	refundAmount?: number;
	refundReason?: string;
}

export interface IPluginSubscriptionCreateInput {
	pluginId: string;
	planId?: string;
	scope: PluginScope;
	autoRenew?: boolean;
	paymentMethod?: string;
	paymentMethodId?: string;
	promoCode?: string;
	metadata?: Record<string, any>;
}

export type IPluginSubscriptionUpdateInput = Partial<IPluginSubscriptionCreateInput>;

export type IPluginPlanCreateInput = Partial<IPluginSubscriptionPlan>;

export enum PluginSubscriptionType {
	FREE = 'free',
	TRIAL = 'trial',
	BASIC = 'basic',
	PREMIUM = 'premium',
	ENTERPRISE = 'enterprise',
	CUSTOM = 'custom'
}

export enum PluginSubscriptionStatus {
	ACTIVE = 'active',
	CANCELLED = 'cancelled',
	EXPIRED = 'expired',
	TRIAL = 'trial',
	PAST_DUE = 'past_due',
	SUSPENDED = 'suspended',
	PENDING = 'pending'
}

export enum PluginBillingPeriod {
	DAILY = 'daily',
	WEEKLY = 'weekly',
	MONTHLY = 'monthly',
	QUARTERLY = 'quarterly',
	YEARLY = 'yearly',
	ONE_TIME = 'one-time'
}

export enum BillingStatus {
	PENDING = 'pending',
	PAID = 'paid',
	FAILED = 'failed',
	CANCELLED = 'cancelled',
	REFUNDED = 'refunded'
}

export enum PaymentStatus {
	PENDING = 'pending',
	COMPLETED = 'completed',
	FAILED = 'failed',
	CANCELLED = 'cancelled',
	REFUNDED = 'refunded'
}

export enum PaymentMethod {
	CREDIT_CARD = 'credit_card',
	DEBIT_CARD = 'debit_card',
	PAYPAL = 'paypal',
	STRIPE = 'stripe',
	BANK_TRANSFER = 'bank_transfer',
	CRYPTOCURRENCY = 'cryptocurrency'
}

/**
 * CDN-hosted plugin source configuration
 */
export interface ICDNSource extends IPluginSource {
	type: PluginSourceType.CDN;
	url: string; // Required URL to the plugin bundle
}

/**
 * NPM-hosted plugin source configuration
 */
export interface INPMSource extends IPluginSource {
	type: PluginSourceType.NPM;
	name: string; // Required package name
}

/**
 * Gauzy-hosted plugin source configuration
 */
export interface IGauzySource extends IPluginSource {
	type: PluginSourceType.GAUZY;
	// Either url or file must be provided
	url?: string; // URL to the plugin bundle
	file?: File; // File to upload
	fileName?: string; // File name
}

/**
 * IPluginTenant Interface
 * Defines the contract for plugin installation and configuration at tenant/organization level
 */
export interface IPluginTenant extends IBasePerTenantAndOrganizationEntityModel {
	/*
	|--------------------------------------------------------------------------
	| Core Properties
	|--------------------------------------------------------------------------
	*/

	/**
	 * Whether the plugin is enabled for this tenant
	 */
	enabled: boolean;

	/**
	 * Scope of the plugin (USER, ORGANIZATION, TENANT)
	 */
	scope: PluginScope;

	/*
	|--------------------------------------------------------------------------
	| Access Control & Permissions
	|--------------------------------------------------------------------------
	*/

	/**
	 * Whether plugin can be installed automatically without user action
	 */
	autoInstall?: boolean;

	/**
	 * Whether plugin requires admin approval before installation
	 */
	requiresApproval?: boolean;

	/**
	 * Whether plugin is mandatory for all users in scope
	 */
	isMandatory?: boolean;

	/*
	|--------------------------------------------------------------------------
	| Usage Limits & Quotas
	|--------------------------------------------------------------------------
	*/

	/**
	 * Maximum number of installations allowed (-1 for unlimited, null for no limit)
	 */
	maxInstallations?: number;

	/**
	 * Maximum number of active users allowed (-1 for unlimited, null for no limit)
	 */
	maxActiveUsers?: number;

	/**
	 * Current number of installations
	 */
	currentInstallations?: number;

	/**
	 * Current number of active users
	 */
	currentActiveUsers?: number;

	/*
	|--------------------------------------------------------------------------
	| Tenant-Specific Configuration
	|--------------------------------------------------------------------------
	*/

	/**
	 * Tenant-specific plugin configuration overrides
	 */
	tenantConfiguration?: Record<string, any>;

	/**
	 * Plugin preferences and UI customizations for this tenant
	 */
	preferences?: Record<string, any>;

	/*
	|--------------------------------------------------------------------------
	| Compliance & Security
	|--------------------------------------------------------------------------
	*/

	/**
	 * Timestamp when the plugin was approved for this tenant
	 */
	approvedAt?: Date;

	/**
	 * ID of the user who approved the plugin for this tenant
	 */
	approvedById?: ID;

	/**
	 * Whether plugin data handling complies with tenant data policies
	 */
	isDataCompliant?: boolean;

	/**
	 * List of compliance certifications applicable to this tenant
	 */
	complianceCertifications?: string[];

	/*
	|--------------------------------------------------------------------------
	| Relationships
	|--------------------------------------------------------------------------
	*/

	/**
	 * Plugin ID
	 */
	pluginId: ID;

	/**
	 * The plugin this configuration applies to
	 */
	plugin?: IPlugin;

	/**
	 * User who approved the plugin for this tenant
	 */
	approvedBy?: IUser;

	/**
	 * Roles explicitly allowed to access this plugin
	 */
	allowedRoles?: IRole[];

	/**
	 * Users explicitly allowed to access this plugin
	 */
	allowedUsers?: IUser[];

	/**
	 * Users explicitly denied access to this plugin
	 */
	deniedUsers?: IUser[];

	/**
	 * Plugin settings specific to this tenant
	 */
	settings?: IPluginSetting[];

	/**
	 * Active subscriptions for this plugin tenant
	 */
	subscriptions?: IPluginSubscription[];

	/*
	|--------------------------------------------------------------------------
	| Virtual Properties
	|--------------------------------------------------------------------------
	*/

	/**
	 * Whether any quota (installations or users) is exceeded
	 */
	isQuotaExceeded?: boolean;

	/**
	 * Whether any limits are configured
	 */
	hasLimits?: boolean;

	/**
	 * Percentage of installation quota used (0-100)
	 */
	installationUtilization?: number;

	/**
	 * Percentage of user quota used (0-100)
	 */
	userUtilization?: number;
}

export enum PluginPricingType {
	FREE = 'free',
	ONE_TIME = 'one_time',
	SUBSCRIPTION = 'subscription',
	FREEMIUM = 'freemium',
	USAGE_BASED = 'usage_based'
}

/**
 * Main plugin interface definition
 */
export interface IPlugin extends IBaseEntityModel {
	name: string; // Plugin name
	description?: string; // Optional description
	type: PluginType; // Type of the plugin
	status: PluginStatus; // Status of the plugin
	versions: IPluginVersion[]; // List of plugin versions
	version?: IPluginVersion; // Current version

	installed: boolean; // Whether the plugin is currently installed

	author?: string; // Optional author information
	license?: string; // Optional license information
	homepage?: string; // Optional homepage URL
	repository?: string; // Optional repository URL

	uploadedBy?: IUser; // User who uploaded the plugin
	uploadedById?: ID; // ID reference for the user who uploaded the plugin
	uploadedAt?: Date; // Optional date when the plugin was uploaded

	source?: IPluginSource; // Optional reference to the plugin's source

	hasPlan: boolean; // Whether the plugin has at least one subscription plan
	downloadCount: number; // Number of times the plugin has been downloaded
	lastDownloadedAt?: Date; // Optional date when the plugin was last downloaded

	// Subscription information
	subscriptions?: IPluginSubscription[]; // Current subscription information if applicable
	requiresSubscription?: boolean; // Whether this plugin requires a subscription

	// Security and verification
	isFeatured?: boolean; // Whether the plugin is featured
	isVerified?: boolean; // Whether the plugin is verified by Gauzy

	// Categories and tags
	categoryId?: ID; // Plugin category ID
	category?: IPluginCategory; // Plugin category
	tags?: IPluginTag[]; // Plugin tags
}

/**
 * Plugin category interface
 */
export interface IPluginCategory extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	description?: string;
	slug?: string;
	color?: string;
	icon?: string;
	order?: number;
	parentId?: ID;
	parent?: IPluginCategory;
}

/**
 * Plugin tag interface
 */
export interface IPluginTag extends IBasePerTenantAndOrganizationEntityModel {
	/**
	 * The plugin associated with this tag relationship
	 */
	plugin: IPlugin;

	/**
	 * ID reference to the plugin
	 */
	pluginId: ID;

	/**
	 * The tag associated with this plugin relationship
	 */
	tag: ITag;

	/**
	 * ID reference to the tag
	 */
	tagId: ID;
}

/**
 * Interface for creating a new plugin
 */
export interface ICreatePlugin
	extends Omit<IPlugin, 'id' | 'downloadCount' | 'uploadedAt' | 'lastDownloadedAt' | 'versions'> {}

/**
 * Interface for updating an existing plugin
 */
export interface IUpdatePlugin extends Partial<ICreatePlugin> {}

export interface IPluginVersion extends IBasePerTenantAndOrganizationEntityModel {
	number: string; // SemVer formatted string
	changelog: string; // Description of changes in the version
	releaseDate?: Date; // Optional ISO 8601 formatted date
	downloadCount?: number; // Optional, defaults to 0

	sources?: IPluginSource[]; // Optional reference to the plugin's source
	installations?: IPluginInstallation[]; // Optional reference to the plugin's installations

	plugin?: IPlugin; // Optional reference to plugin
	pluginId?: ID; // ID reference for plugin

	// Security and integrity
	checksum?: string; // Verification hash
	signature?: string; // Digital signature for verification
}

/**
 * Common interface for all plugin source types
 */
export interface IPluginSource extends IBasePerTenantAndOrganizationEntityModel {
	type: PluginSourceType; // Type of the plugin source (CDN, NPM, GAUZY)
	fullName?: string; // Full name of the source
	operatingSystem: PluginOSType; // Operating system target
	architecture: PluginOSArch;

	// Common for CDN and GAUZY sources
	url?: string; // URL to the plugin bundle
	integrity?: string; // SRI hash for security verification
	crossOrigin?: string; // CORS setting ('anonymous' | 'use-credentials')

	// Specific to NPM sources
	name?: string; // Package name (for NPM)
	registry?: string; // Optional custom NPM registry URL
	private?: boolean; // Optional flag for private packages
	scope?: string; // Optional package scope (e.g., '@organization')

	// Specific to GAUZY/file upload sources
	file?: File; // File to upload
	filePath?: string; // Path to the uploaded plugin file
	fileName?: string; // Name of the uploaded plugin file
	fileSize?: number; // File size in bytes
	mimeType?: string; // File MIME type
	fileKey?: string; // Unique key for the uploaded file

	// Associated Plugin Version
	version?: IPluginVersion; // Associated plugin version entity
	versionId?: ID; // ID of the associated plugin version
}

export enum PluginInstallationStatus {
	INSTALLED = 'INSTALLED',
	UNINSTALLED = 'UNINSTALLED',
	FAILED = 'FAILED',
	IN_PROGRESS = 'IN_PROGRESS'
}
/**
 * Plugin installation record
 */
export interface IPluginInstallation extends IBasePerTenantAndOrganizationEntityModel {
	plugin: IPlugin; // Installed plugin entity
	pluginId?: ID; // ID reference for the installed plugin

	version: IPluginVersion; // Installed version of the plugin
	versionId?: ID; // ID reference for the installed plugin version

	installedBy?: IEmployee; // Employee who installed the plugin
	installedById?: ID; // ID reference for the employee who installed the plugin

	installedAt?: Date; // Optional date when the plugin was installed
	uninstalledAt?: Date; // Optional date when the plugin was uninstalled

	status: PluginInstallationStatus; // Status of the plugin installation
}

export interface IPluginAccess {
	hasAccess: boolean;
	subscription: IPluginSubscription;
	accessLevel: PluginScope;
	canAssign: boolean;
	canActivate: boolean;
	requiresSubscription: boolean;
}
