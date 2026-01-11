import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FindManyOptions, FindOptionsWhere, In, IsNull } from 'typeorm';
import { indexBy, keys, object, pluck } from 'underscore';
import { ID, IResolvedSystemSetting, SystemSettingScope } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud';
import { MultiORMEnum, parseTypeORMFindToMikroOrm } from '../core/utils';
import { SystemSetting } from './system-setting.entity';
import { TypeOrmSystemSettingRepository } from './repository/type-orm-system-setting.repository';
import { MikroOrmSystemSettingRepository } from './repository/mikro-orm-system-setting.repository';
import {
	getDefaultValue,
	getEnvVarName,
	getSettingMetadata,
	isSettingAllowedAtScope
} from './system-setting.constants';

@Injectable()
export class SystemSettingService extends TenantAwareCrudService<SystemSetting> {
	constructor(
		readonly typeOrmSystemSettingRepository: TypeOrmSystemSettingRepository,
		readonly mikroOrmSystemSettingRepository: MikroOrmSystemSettingRepository,
		private readonly configService: ConfigService
	) {
		super(typeOrmSystemSettingRepository, mikroOrmSystemSettingRepository);
	}

	/**
	 * Retrieves settings from the database for a specific scope.
	 *
	 * @param {FindManyOptions} [request] - Optional query options for filtering settings.
	 * @returns {Promise<Record<string, any>>} - A key-value pair object where keys are setting names and values are setting values with converted types.
	 */
	async getSettings(request?: FindManyOptions<SystemSetting>): Promise<Record<string, any>> {
		let settings: SystemSetting[];

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<SystemSetting>(request);
				const items = await this.mikroOrmRepository.find(where, mikroOptions);
				settings = items.map((entity: SystemSetting) => this.serialize(entity)) as SystemSetting[];
				break;
			}
			case MultiORMEnum.TypeORM:
				settings = await this.typeOrmRepository.find(request);
				break;
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}

		const result: Record<string, any> = {};
		for (const setting of settings) {
			result[setting.name] = this.convertValueToType(setting.value, setting.name);
		}
		return result;
	}

	/**
	 * Retrieves settings with cascade resolution.
	 * Resolution order: Organization → Tenant → Global → ENV → Default
	 *
	 * @param {string[]} settingNames - List of setting names to retrieve.
	 * @param {ID} [tenantId] - Optional tenant ID for tenant/organization scope.
	 * @param {ID} [organizationId] - Optional organization ID for organization scope.
	 * @returns {Promise<Record<string, any>>} - A key-value pair object with resolved setting values.
	 */
	async getSettingsWithCascade(
		settingNames: string[],
		tenantId?: ID,
		organizationId?: ID
	): Promise<Record<string, any>> {
		const result: Record<string, any> = {};

		for (const name of settingNames) {
			const resolved = await this.resolveSettingValue(name, tenantId, organizationId);
			result[name] = resolved.value;
		}

		return result;
	}

	/**
	 * Converts a string value to its proper type based on setting metadata.
	 *
	 * @param {string} value - The string value to convert.
	 * @param {string} settingKey - The setting key to determine the type.
	 * @returns {any} - The converted value (string, boolean, or number).
	 */
	private convertValueToType(value: string | undefined | null, settingKey: string): any {
		if (value === undefined || value === null || value === '') {
			return value;
		}

		const metadata = getSettingMetadata(settingKey);
		if (!metadata) {
			// If no metadata, return as string
			return value;
		}

		switch (metadata.type) {
			case 'boolean':
				const normalized = String(value).toLowerCase().trim();
				return normalized === 'true' || normalized === '1';
			case 'number':
				const num = Number(value);
				return isNaN(num) ? value : num;
			case 'string':
			default:
				return value;
		}
	}

	/**
	 * Resolves a single setting value using cascade resolution.
	 * Resolution order: Organization → Tenant → Global → ENV → Default
	 * Only checks scopes that are allowed for the setting based on metadata.
	 *
	 * @param {string} name - The setting name to resolve.
	 * @param {ID} [tenantId] - Optional tenant ID.
	 * @param {ID} [organizationId] - Optional organization ID.
	 * @returns {Promise<IResolvedSystemSetting>} - The resolved setting with its source.
	 */
	async resolveSettingValue(name: string, tenantId?: ID, organizationId?: ID): Promise<IResolvedSystemSetting> {
		if (tenantId && organizationId && isSettingAllowedAtScope(name, SystemSettingScope.ORGANIZATION)) {
			const orgSetting = await this.findSettingByScope(name, tenantId, organizationId);
			if (orgSetting?.value !== undefined && orgSetting?.value !== null) {
				const convertedValue = this.convertValueToType(orgSetting.value, name);
				return { name, value: convertedValue, source: SystemSettingScope.ORGANIZATION };
			}
		}

		if (tenantId && isSettingAllowedAtScope(name, SystemSettingScope.TENANT)) {
			const tenantSetting = await this.findSettingByScope(name, tenantId, null);
			if (tenantSetting?.value !== undefined && tenantSetting?.value !== null) {
				const convertedValue = this.convertValueToType(tenantSetting.value, name);
				return { name, value: convertedValue, source: SystemSettingScope.TENANT };
			}
		}

		if (isSettingAllowedAtScope(name, SystemSettingScope.GLOBAL)) {
			const globalSetting = await this.findSettingByScope(name, null, null);
			if (globalSetting?.value !== undefined && globalSetting?.value !== null) {
				const convertedValue = this.convertValueToType(globalSetting.value, name);
				return { name, value: convertedValue, source: SystemSettingScope.GLOBAL };
			}
		}

		const envVarName = getEnvVarName(name);
		if (envVarName) {
			const envValue = this.configService.get(envVarName);
			if (envValue !== undefined && envValue !== '') {
				const convertedValue = this.convertValueToType(String(envValue), name);
				return { name, value: convertedValue, source: 'ENV' };
			}
		}

		const defaultValue = getDefaultValue(name);
		return {
			name,
			value: defaultValue !== undefined ? this.convertValueToType(String(defaultValue), name) : undefined,
			source: 'DEFAULT'
		};
	}

	/**
	 * Finds a setting by its scope.
	 *
	 * @param {string} name - The setting name.
	 * @param {ID | null} tenantId - The tenant ID (null for global).
	 * @param {ID | null} organizationId - The organization ID (null for tenant or global).
	 * @returns {Promise<SystemSetting | null>} - The found setting or null.
	 */
	private async findSettingByScope(
		name: string,
		tenantId: ID | null,
		organizationId: ID | null
	): Promise<SystemSetting | null> {
		const whereClause: FindOptionsWhere<SystemSetting> = {
			name,
			tenantId: tenantId ?? IsNull(),
			organizationId: organizationId ?? IsNull()
		};

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<SystemSetting>({
					where: whereClause
				});
				const item = await this.mikroOrmRepository.findOne(where, mikroOptions);
				return item ? (this.serialize(item) as SystemSetting) : null;
			}
			case MultiORMEnum.TypeORM:
				return await this.typeOrmRepository.findOne({
					where: whereClause
				});
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}
	}

	/**
	 * Converts a value to string for storage, preserving type information.
	 *
	 * @param {any} value - The value to convert.
	 * @returns {string | null} - The string representation or null.
	 */
	private convertValueToString(value: any): string | null {
		if (value === undefined || value === null) {
			return null;
		}
		return String(value);
	}

	/**
	 * Saves settings for a specific scope.
	 * Validates that each setting is allowed at the requested scope based on metadata.
	 *
	 * @param {Record<string, any>} input - Key-value pairs of settings to save.
	 * @param {SystemSettingScope} scope - The scope at which to save the settings.
	 * @param {ID} [tenantId] - The tenant ID (required for TENANT and ORGANIZATION scopes).
	 * @param {ID} [organizationId] - The organization ID (required for ORGANIZATION scope).
	 * @returns {Promise<Record<string, any>>} - The saved settings as key-value pairs.
	 */
	async saveSettings(
		input: Record<string, any>,
		scope: SystemSettingScope,
		tenantId?: ID,
		organizationId?: ID
	): Promise<Record<string, any>> {
		this.validateScopeRequirements(scope, tenantId, organizationId);

		for (const key of keys(input)) {
			this.validateSettingScopeAllowed(key, scope);
		}

		const effectiveTenantId = scope === SystemSettingScope.GLOBAL ? null : tenantId;
		const effectiveOrgId = scope === SystemSettingScope.ORGANIZATION ? organizationId : null;

		const whereClause: FindOptionsWhere<SystemSetting> = {
			name: In(keys(input)),
			tenantId: effectiveTenantId ?? IsNull(),
			organizationId: effectiveOrgId ?? IsNull()
		};

		let existingSettings: SystemSetting[];
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<SystemSetting>({
					where: whereClause
				});
				const items = await this.mikroOrmRepository.find(where, mikroOptions);
				existingSettings = items.map((entity: SystemSetting) => this.serialize(entity)) as SystemSetting[];
				break;
			}
			case MultiORMEnum.TypeORM:
				existingSettings = await this.typeOrmRepository.find({
					where: whereClause
				});
				break;
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}

		const settingsByName = indexBy(existingSettings, 'name');
		const saveInput: SystemSetting[] = [];

		for (const key in input) {
			if (Object.prototype.hasOwnProperty.call(input, key)) {
				const existing = settingsByName[key];
				const value = this.convertValueToString(input[key]);

				if (existing) {
					existing.value = value;
					saveInput.push(existing);
				} else {
					saveInput.push(
						new SystemSetting({
							name: key,
							value,
							tenantId: effectiveTenantId,
							organizationId: effectiveOrgId
						})
					);
				}
			}
		}

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const mikroEntities: SystemSetting[] = [];
				for (const setting of saveInput) {
					if (setting.id) {
						const existing = await this.mikroOrmRepository.findOne(setting.id);
						if (existing) {
							this.mikroOrmRepository.assign(existing, { value: setting.value });
							mikroEntities.push(existing);
						}
					} else {
						const newEntity = this.mikroOrmRepository.create(setting, {
							managed: true,
							partial: true
						});
						mikroEntities.push(newEntity);
					}
				}
				await this.mikroOrmRepository.persistAndFlush(mikroEntities);
				for (let i = 0; i < saveInput.length; i++) {
					saveInput[i] = this.serialize(mikroEntities[i]) as SystemSetting;
				}
				break;
			}
			case MultiORMEnum.TypeORM:
				await this.typeOrmRepository.save(saveInput);
				break;
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}

		const result: Record<string, any> = {};
		for (const setting of saveInput) {
			result[setting.name] = this.convertValueToType(setting.value, setting.name);
		}
		return result;
	}

	/**
	 * Retrieves settings for a specific scope (without cascade).
	 *
	 * @param {SystemSettingScope} scope - The scope to retrieve settings for.
	 * @param {ID} [tenantId] - The tenant ID.
	 * @param {ID} [organizationId] - The organization ID.
	 * @returns {Promise<Record<string, any>>} - The settings as key-value pairs with converted types.
	 */
	async getSettingsByScope(
		scope: SystemSettingScope,
		tenantId?: ID,
		organizationId?: ID
	): Promise<Record<string, any>> {
		const effectiveTenantId = scope === SystemSettingScope.GLOBAL ? null : tenantId;
		const effectiveOrgId = scope === SystemSettingScope.ORGANIZATION ? organizationId : null;

		const whereClause: FindOptionsWhere<SystemSetting> = {
			tenantId: effectiveTenantId ?? IsNull(),
			organizationId: effectiveOrgId ?? IsNull()
		};

		let settings: SystemSetting[];
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<SystemSetting>({
					where: whereClause
				});
				const items = await this.mikroOrmRepository.find(where, mikroOptions);
				settings = items.map((entity: SystemSetting) => this.serialize(entity)) as SystemSetting[];
				break;
			}
			case MultiORMEnum.TypeORM:
				settings = await this.typeOrmRepository.find({
					where: whereClause
				});
				break;
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}

		const result: Record<string, any> = {};
		for (const setting of settings) {
			result[setting.name] = this.convertValueToType(setting.value, setting.name);
		}
		return result;
	}

	/**
	 * Validates that the required IDs are provided for the given scope.
	 *
	 * @param {SystemSettingScope} scope - The scope to validate.
	 * @param {ID} [tenantId] - The tenant ID.
	 * @param {ID} [organizationId] - The organization ID.
	 */
	private validateScopeRequirements(scope: SystemSettingScope, tenantId?: ID, organizationId?: ID): void {
		if (scope === SystemSettingScope.ORGANIZATION && (!tenantId || !organizationId)) {
			throw new BadRequestException('tenantId and organizationId are required for ORGANIZATION scope');
		}
		if (scope === SystemSettingScope.TENANT && !tenantId) {
			throw new BadRequestException('tenantId is required for TENANT scope');
		}
	}

	/**
	 * Validates that a setting is allowed at the specified scope.
	 *
	 * @param {string} settingKey - The setting key to validate.
	 * @param {SystemSettingScope} scope - The scope to check.
	 * @throws {BadRequestException} If the setting is not allowed at the specified scope.
	 */
	private validateSettingScopeAllowed(settingKey: string, scope: SystemSettingScope): void {
		const metadata = getSettingMetadata(settingKey);

		// If no metadata defined, allow at all scopes (for flexibility with custom settings)
		if (!metadata) {
			return;
		}

		if (!metadata.allowedScopes.includes(scope)) {
			throw new BadRequestException(
				`Setting "${settingKey}" cannot be defined at ${scope} level. Allowed scopes: ${metadata.allowedScopes.join(
					', '
				)}`
			);
		}
	}
}
