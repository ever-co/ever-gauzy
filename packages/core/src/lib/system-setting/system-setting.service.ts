import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FindManyOptions, FindOptionsWhere, In, IsNull, QueryFailedError } from 'typeorm';
import { ID, IResolvedSystemSetting, SystemSettingScope } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud';
import { MultiORMEnum, parseTypeORMFindToMikroOrm } from '../core/utils';
import { ConnectionEntityManager } from '../database/connection-entity-manager';
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
	private readonly logger = new Logger(SystemSettingService.name);

	constructor(
		readonly typeOrmSystemSettingRepository: TypeOrmSystemSettingRepository,
		readonly mikroOrmSystemSettingRepository: MikroOrmSystemSettingRepository,
		private readonly configService: ConfigService,
		private readonly connectionEntityManager: ConnectionEntityManager
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
		if (!settingNames || settingNames.length === 0) {
			return {};
		}

		const result: Record<string, any> = {};

		// Optimize: Fetch only requested settings for each scope using In() (O(3) instead of O(n*3))
		const effectiveTenantId = tenantId ?? null;
		const effectiveOrgId = organizationId ?? null;

		// Fetch organization settings (only requested names)
		const orgSettings: Record<string, any> = {};
		if (effectiveTenantId && effectiveOrgId) {
			const orgSettingsList = await this.findSettingsByNamesAndScope(
				settingNames,
				SystemSettingScope.ORGANIZATION,
				effectiveTenantId,
				effectiveOrgId
			);
			for (const setting of orgSettingsList) {
				// Only include settings allowed at organization scope
				if (
					isSettingAllowedAtScope(setting.name, SystemSettingScope.ORGANIZATION) &&
					setting.value !== undefined &&
					setting.value !== null &&
					setting.value !== ''
				) {
					orgSettings[setting.name] = this.convertValueToType(setting.value, setting.name);
				}
			}
		}

		// Fetch tenant settings (only requested names not found in organization)
		const tenantSettings: Record<string, any> = {};
		if (effectiveTenantId) {
			const missingNames = settingNames.filter((name) => orgSettings[name] === undefined);
			if (missingNames.length > 0) {
				const tenantSettingsList = await this.findSettingsByNamesAndScope(
					missingNames,
					SystemSettingScope.TENANT,
					effectiveTenantId
				);
			for (const setting of tenantSettingsList) {
				// Only include settings allowed at tenant scope
				if (
					isSettingAllowedAtScope(setting.name, SystemSettingScope.TENANT) &&
					setting.value !== undefined &&
					setting.value !== null &&
					setting.value !== ''
				) {
					tenantSettings[setting.name] = this.convertValueToType(setting.value, setting.name);
				}
			}
			}
		}

		// Fetch global settings (only requested names not found in organization or tenant)
		const globalSettings: Record<string, any> = {};
		const missingNames = settingNames.filter(
			(name) => orgSettings[name] === undefined && tenantSettings[name] === undefined
		);
		if (missingNames.length > 0) {
			const globalSettingsList = await this.findSettingsByNamesAndScope(missingNames, SystemSettingScope.GLOBAL);
			for (const setting of globalSettingsList) {
				// Only include settings allowed at global scope
				if (
					isSettingAllowedAtScope(setting.name, SystemSettingScope.GLOBAL) &&
					setting.value !== undefined &&
					setting.value !== null &&
					setting.value !== ''
				) {
					globalSettings[setting.name] = this.convertValueToType(setting.value, setting.name);
				}
			}
		}

		// Resolve each setting using cascade logic (Organization → Tenant → Global → ENV → Default)
		// Reuse resolveSettingValue for ENV/DEFAULT fallback to avoid duplication
		for (const name of settingNames) {
			// Check organization first
			if (orgSettings[name] !== undefined) {
				result[name] = orgSettings[name];
				continue;
			}

			// Check tenant
			if (tenantSettings[name] !== undefined) {
				result[name] = tenantSettings[name];
				continue;
			}

			// Check global
			if (globalSettings[name] !== undefined) {
				result[name] = globalSettings[name];
				continue;
			}

			// Fallback to ENV and DEFAULT (no database queries needed - we already checked all scopes)
			result[name] = this.resolveEnvAndDefaultValue(name);
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
			case 'boolean': {
				const normalized = String(value).toLowerCase().trim();
				return normalized === 'true' || normalized === '1';
			}
			case 'number': {
				const num = Number(value);
				return isNaN(num) ? value : num;
			}
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
			if (orgSetting?.value !== undefined && orgSetting?.value !== null && orgSetting?.value !== '') {
				const convertedValue = this.convertValueToType(orgSetting.value, name);
				return { name, value: convertedValue, source: SystemSettingScope.ORGANIZATION };
			}
		}

		if (tenantId && isSettingAllowedAtScope(name, SystemSettingScope.TENANT)) {
			const tenantSetting = await this.findSettingByScope(name, tenantId, null);
			if (tenantSetting?.value !== undefined && tenantSetting?.value !== null && tenantSetting?.value !== '') {
				const convertedValue = this.convertValueToType(tenantSetting.value, name);
				return { name, value: convertedValue, source: SystemSettingScope.TENANT };
			}
		}

		if (isSettingAllowedAtScope(name, SystemSettingScope.GLOBAL)) {
			const globalSetting = await this.findSettingByScope(name, null, null);
			if (globalSetting?.value !== undefined && globalSetting?.value !== null && globalSetting?.value !== '') {
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
		if (defaultValue === undefined) {
			return {
				name,
				value: undefined,
				source: 'DEFAULT'
			};
		}
		return {
			name,
			value: this.convertValueToType(String(defaultValue), name),
			source: 'DEFAULT'
		};
	}

	/**
	 * Resolves ENV and DEFAULT values without database queries.
	 * Used as fallback when we already know the setting doesn't exist in database.
	 *
	 * @param {string} name - The setting name.
	 * @returns {any} - The resolved value from ENV or DEFAULT, or undefined.
	 */
	private resolveEnvAndDefaultValue(name: string): any {
		const envVarName = getEnvVarName(name);
		if (envVarName) {
			const envValue = this.configService.get(envVarName);
			if (envValue !== undefined && envValue !== '') {
				return this.convertValueToType(String(envValue), name);
			}
		}

		const defaultValue = getDefaultValue(name);
		if (defaultValue !== undefined) {
			return this.convertValueToType(String(defaultValue), name);
		}

		return undefined;
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
				return item ? this.serialize(item as SystemSetting) : null;
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
	 * Finds multiple settings by names and scope in a single query (optimized batch fetch).
	 *
	 * @param {string[]} names - Array of setting names to fetch.
	 * @param {SystemSettingScope} scope - The scope to search in.
	 * @param {ID | null} [tenantId] - The tenant ID (null for global).
	 * @param {ID | null} [organizationId] - The organization ID (null for tenant or global).
	 * @returns {Promise<SystemSetting[]>} - Array of found settings.
	 */
	private async findSettingsByNamesAndScope(
		names: string[],
		scope: SystemSettingScope,
		tenantId?: ID | null,
		organizationId?: ID | null
	): Promise<SystemSetting[]> {
		if (!names || names.length === 0) {
			return [];
		}

		const effectiveTenantId = scope === SystemSettingScope.GLOBAL ? null : tenantId ?? null;
		const effectiveOrgId = scope === SystemSettingScope.ORGANIZATION ? organizationId ?? null : null;

		const whereClause: FindOptionsWhere<SystemSetting> = {
			name: In(names),
			tenantId: effectiveTenantId ?? IsNull(),
			organizationId: effectiveOrgId ?? IsNull()
		};

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<SystemSetting>({
					where: whereClause
				});
				const items = await this.mikroOrmRepository.find(where, mikroOptions);
				return items.map((entity: SystemSetting) => this.serialize(entity)) as SystemSetting[];
			}
			case MultiORMEnum.TypeORM:
				return await this.typeOrmRepository.find({
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

		for (const key of Object.keys(input)) {
			this.validateSettingScopeAllowed(key, scope);
		}

		const effectiveTenantId = scope === SystemSettingScope.GLOBAL ? null : tenantId;
		const effectiveOrgId = scope === SystemSettingScope.ORGANIZATION ? organizationId : null;

		switch (this.ormType) {
			case MultiORMEnum.TypeORM: {
				const queryRunner = this.connectionEntityManager.rawConnection.createQueryRunner();

				try {
					await queryRunner.connect();
					await queryRunner.startTransaction();
					const result: Record<string, any> = {};

					for (const key in input) {
						if (Object.prototype.hasOwnProperty.call(input, key)) {
							const value = this.convertValueToString(input[key]);
							const whereClause: FindOptionsWhere<SystemSetting> = {
								name: key,
								tenantId: effectiveTenantId ?? IsNull(),
								organizationId: effectiveOrgId ?? IsNull()
							};

							let setting = await queryRunner.manager.findOne(SystemSetting, {
								where: whereClause
							});

							if (setting) {
								setting.value = value;
								setting = await queryRunner.manager.save(setting);
							} else {
								setting = queryRunner.manager.create(SystemSetting, {
									name: key,
									value,
									tenantId: effectiveTenantId,
									organizationId: effectiveOrgId
								});
								setting = await queryRunner.manager.save(setting);
							}

							result[setting.name] = this.convertValueToType(setting.value, setting.name);
						}
					}

					await queryRunner.commitTransaction();
					return result;
				} catch (error) {
					await queryRunner.rollbackTransaction();
					// Log full error with context for debugging
					this.logger.error(
						`Failed to save settings: ${JSON.stringify({
							scope,
							tenantId,
							organizationId,
							keys: Object.keys(input)
						})}`,
						error.stack || error
					);

					// Check for unique constraint violation (race condition)
					if (error instanceof QueryFailedError) {
						const errorMessage = error.message?.toLowerCase() || '';
						const isUniqueConstraintError =
							errorMessage.includes('unique constraint') ||
							errorMessage.includes('duplicate key') ||
							errorMessage.includes('duplicate entry') ||
							errorMessage.includes('unique violation');
						if (isUniqueConstraintError) {
							throw new BadRequestException(
								'A setting with the same name already exists at this scope. Please try again.'
							);
						}
					}

					// Throw generic error without exposing internal details
					throw new BadRequestException('Failed to save settings');
				} finally {
					await queryRunner.release();
				}
			}
			case MultiORMEnum.MikroORM: {
				try {
					return await this.mikroOrmRepository.getEntityManager().transactional(async (em) => {
						const result: Record<string, any> = {};
						const settingsToPersist: SystemSetting[] = [];

						for (const key in input) {
							if (Object.prototype.hasOwnProperty.call(input, key)) {
								const value = this.convertValueToString(input[key]);
								const { where } = parseTypeORMFindToMikroOrm<SystemSetting>({
									where: {
										name: key,
										tenantId: effectiveTenantId ?? IsNull(),
										organizationId: effectiveOrgId ?? IsNull()
									}
								});

								let setting = await em.findOne(SystemSetting, where);

								if (setting) {
									em.assign(setting, { value });
								} else {
									setting = em.create(SystemSetting, {
										name: key,
										value,
										tenantId: effectiveTenantId,
										organizationId: effectiveOrgId
									});
									em.persist(setting);
								}

								settingsToPersist.push(setting);
							}
						}

						// Batch flush all operations at once
						await em.flush();

						// Build result after flush
						for (const setting of settingsToPersist) {
							const serialized = this.serialize(setting) as SystemSetting;
							result[serialized.name] = this.convertValueToType(serialized.value, serialized.name);
						}

						return result;
					});
				} catch (error) {
					// Log full error with context for debugging
					this.logger.error(
						`Failed to save settings: ${JSON.stringify({
							scope,
							tenantId,
							organizationId,
							keys: Object.keys(input)
						})}`,
						error.stack || error
					);

					// Check for unique constraint violation (race condition)
					// MikroORM throws different error types, check for unique constraint violations
					const errorMessage = (error?.message || String(error)).toLowerCase();
					const isUniqueConstraintError =
						errorMessage.includes('unique constraint') ||
						errorMessage.includes('duplicate key') ||
						errorMessage.includes('duplicate entry') ||
						errorMessage.includes('unique violation');
					if (isUniqueConstraintError) {
						throw new BadRequestException(
							'A setting with the same name already exists at this scope. Please try again.'
						);
					}

					// Throw generic error without exposing internal details
					throw new BadRequestException('Failed to save settings');
				}
			}
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}
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
		// Validate required scope parameters
		this.validateScopeRequirements(scope, tenantId, organizationId);

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
