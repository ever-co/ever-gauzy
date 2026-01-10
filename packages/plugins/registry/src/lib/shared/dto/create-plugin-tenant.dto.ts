import { ID, IRole, IUser, PluginScope } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	Min,
	ValidateIf,
	ValidateNested
} from 'class-validator';

export class CreatePluginTenantDTO {
	/*
	|--------------------------------------------------------------------------
	| @ApiProperty Properties
	|--------------------------------------------------------------------------
	*/

	@ApiProperty({ type: () => String, description: 'Plugin ID' })
	@IsNotEmpty()
	@IsUUID()
	pluginId: ID;

	@ApiProperty({ type: Boolean, description: 'Whether the plugin is enabled for this tenant', default: true })
	@IsNotEmpty()
	@IsBoolean()
	enabled: boolean;

	@ApiProperty({ enum: PluginScope, description: 'Scope of the plugin (USER, ORGANIZATION, TENANT)' })
	@IsNotEmpty()
	@IsEnum(PluginScope)
	scope: PluginScope;

	/*
	|--------------------------------------------------------------------------
	| @ApiPropertyOptional Properties
	|--------------------------------------------------------------------------
	*/

	@ApiPropertyOptional({ type: () => String, description: 'Tenant ID' })
	@IsOptional()
	@IsUUID()
	tenantId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Organization ID' })
	@IsOptional()
	@IsUUID()
	organizationId?: ID;

	/**
	 * Access Control & Permissions
	 */
	@ApiPropertyOptional({
		type: Boolean,
		description: 'Whether plugin can be installed automatically without user action',
		default: false
	})
	@IsOptional()
	@IsBoolean()
	autoInstall?: boolean;

	@ApiPropertyOptional({
		type: Boolean,
		description: 'Whether plugin requires admin approval before installation',
		default: true
	})
	@IsOptional()
	@IsBoolean()
	requiresApproval?: boolean;

	@ApiPropertyOptional({
		type: Boolean,
		description: 'Whether plugin is mandatory for all users in scope',
		default: false
	})
	@IsOptional()
	@IsBoolean()
	isMandatory?: boolean;

	/**
	 * Usage Limits & Quotas
	 */
	@ApiPropertyOptional({
		type: Number,
		description: 'Maximum number of installations allowed (-1 for unlimited, null for no limit)',
		example: 100
	})
	@IsOptional()
	@ValidateIf((o) => o.maxInstallations !== null && o.maxInstallations !== undefined)
	@IsInt()
	@Min(-1)
	maxInstallations?: number;

	@ApiPropertyOptional({
		type: Number,
		description: 'Maximum number of active users allowed (-1 for unlimited, null for no limit)',
		example: 50
	})
	@IsOptional()
	@ValidateIf((o) => o.maxActiveUsers !== null && o.maxActiveUsers !== undefined)
	@IsInt()
	@Min(-1)
	maxActiveUsers?: number;

	/**
	 * Tenant-Specific Configuration
	 */
	@ApiPropertyOptional({
		type: Object,
		description: 'Tenant-specific plugin configuration overrides',
		example: {
			branding: { logo: 'tenant-logo.png', theme: 'blue' },
			features: { advancedReporting: true },
			limits: { dailyUsage: 1000 }
		}
	})
	@IsOptional()
	@IsObject()
	tenantConfiguration?: Record<string, any>;

	@ApiPropertyOptional({
		type: Object,
		description: 'Plugin preferences and UI customizations for this tenant',
		example: {
			defaultSettings: { autoSave: true, notifications: false },
			uiCustomizations: { hideAdvancedOptions: true }
		}
	})
	@IsOptional()
	@IsObject()
	preferences?: Record<string, any>;

	/**
	 * Compliance & Security
	 */
	@ApiPropertyOptional({
		type: Boolean,
		description: 'Whether plugin data handling complies with tenant data policies',
		default: true
	})
	@IsOptional()
	@IsBoolean()
	isDataCompliant?: boolean;

	@ApiPropertyOptional({
		type: [String],
		description: 'List of compliance certifications applicable to this tenant',
		example: ['SOC2', 'GDPR', 'HIPAA']
	})
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	complianceCertifications?: string[];

	/**
	 * Access Control - Role IDs
	 */
	@ApiPropertyOptional({
		type: [String],
		description: 'Array of role IDs explicitly allowed to access this plugin'
	})
	@IsOptional()
	@IsArray()
	@IsUUID(undefined, { each: true })
	allowedRoleIds?: ID[];

	@ApiPropertyOptional({
		type: [String],
		description: 'Array of user IDs explicitly allowed to access this plugin'
	})
	@IsOptional()
	@IsArray()
	@IsUUID(undefined, { each: true })
	allowedUserIds?: ID[];

	@ApiPropertyOptional({
		type: [String],
		description: 'Array of user IDs explicitly denied access to this plugin'
	})
	@IsOptional()
	@IsArray()
	@IsUUID(undefined, { each: true })
	deniedUserIds?: ID[];

	/**
	 * Access Control - Objects (for nested operations)
	 */
	@ApiPropertyOptional({
		type: [Object],
		description: 'Array of roles explicitly allowed to access this plugin'
	})
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => Object)
	allowedRoles?: IRole[];

	@ApiPropertyOptional({
		type: [Object],
		description: 'Array of users explicitly allowed to access this plugin'
	})
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => Object)
	allowedUsers?: IUser[];

	@ApiPropertyOptional({
		type: [Object],
		description: 'Array of users explicitly denied access to this plugin'
	})
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => Object)
	deniedUsers?: IUser[];
}
