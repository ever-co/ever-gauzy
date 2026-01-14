import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { isMySQL } from '@gauzy/config';
import { DataSource, EntityManager, In, IsNull, QueryFailedError } from 'typeorm';
import { ID, IResolvedSystemSetting, SystemSettingScope } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud';
import { MultiORMEnum } from '../core/utils';
import { SystemSetting } from './system-setting.entity';
import { TypeOrmSystemSettingRepository } from './repository/type-orm-system-setting.repository';
import { MikroOrmSystemSettingRepository } from './repository/mikro-orm-system-setting.repository';
import {
	getDefaultValue,
	getEnvVarName,
	getSettingMetadata,
	isSettingAllowedAtScope
} from './system-setting.constants';
import { convertSettingValue } from './system-setting.helper';

@Injectable()
export class SystemSettingService extends TenantAwareCrudService<SystemSetting> {
	constructor(
		readonly typeOrmSystemSettingRepository: TypeOrmSystemSettingRepository,
		readonly mikroOrmSystemSettingRepository: MikroOrmSystemSettingRepository,
		private readonly configService: NestConfigService,
		private readonly dataSource: DataSource
	) {
		super(typeOrmSystemSettingRepository, mikroOrmSystemSettingRepository);
	}

	/**
	 * Resolves settings with cascade: Organization → Tenant → Global → ENV → Default
	 */
	async getSettingsWithCascade(names: string[], tenantId?: ID, organizationId?: ID): Promise<Record<string, any>> {
		if (!names?.length) return {};

		const result: Record<string, any> = {};
		const remaining = new Set(names);

		// Organization scope (value !== null/undefined stops cascade, empty string is valid)
		if (tenantId && organizationId) {
			for (const s of await this.findByNamesAndScope([...remaining], tenantId, organizationId)) {
				if (
					s.value !== null &&
					s.value !== undefined &&
					isSettingAllowedAtScope(s.name, SystemSettingScope.ORGANIZATION)
				) {
					result[s.name] = convertSettingValue(s.value, s.name);
					remaining.delete(s.name);
				}
			}
		}

		// Tenant scope
		if (tenantId && remaining.size) {
			for (const s of await this.findByNamesAndScope([...remaining], tenantId, null)) {
				if (
					s.value !== null &&
					s.value !== undefined &&
					isSettingAllowedAtScope(s.name, SystemSettingScope.TENANT)
				) {
					result[s.name] = convertSettingValue(s.value, s.name);
					remaining.delete(s.name);
				}
			}
		}

		// Global scope
		if (remaining.size) {
			for (const s of await this.findByNamesAndScope([...remaining], null, null)) {
				if (
					s.value !== null &&
					s.value !== undefined &&
					isSettingAllowedAtScope(s.name, SystemSettingScope.GLOBAL)
				) {
					result[s.name] = convertSettingValue(s.value, s.name);
					remaining.delete(s.name);
				}
			}
		}

		// ENV and Default fallback
		for (const name of remaining) {
			result[name] = this.resolveEnvOrDefault(name).value;
		}

		return result;
	}

	/**
	 * Resolves a single setting with source information.
	 */
	async resolveSettingValue(name: string, tenantId?: ID, organizationId?: ID): Promise<IResolvedSystemSetting> {
		// Organization (value !== null/undefined stops cascade)
		if (tenantId && organizationId && isSettingAllowedAtScope(name, SystemSettingScope.ORGANIZATION)) {
			const setting = await this.findByScope(name, tenantId, organizationId);
			if (setting?.value !== null && setting?.value !== undefined) {
				return {
					name,
					value: convertSettingValue(setting.value, name),
					source: SystemSettingScope.ORGANIZATION
				};
			}
		}

		// Tenant
		if (tenantId && isSettingAllowedAtScope(name, SystemSettingScope.TENANT)) {
			const setting = await this.findByScope(name, tenantId, null);
			if (setting?.value !== null && setting?.value !== undefined) {
				return { name, value: convertSettingValue(setting.value, name), source: SystemSettingScope.TENANT };
			}
		}

		// Global
		if (isSettingAllowedAtScope(name, SystemSettingScope.GLOBAL)) {
			const setting = await this.findByScope(name, null, null);
			if (setting?.value !== null && setting?.value !== undefined) {
				return { name, value: convertSettingValue(setting.value, name), source: SystemSettingScope.GLOBAL };
			}
		}

		// ENV or Default fallback
		const fallback = this.resolveEnvOrDefault(name);
		return { name, ...fallback };
	}

	/**
	 * Saves settings at a specific scope.
	 * Wrapped in a transaction to ensure atomicity - all settings saved or none.
	 * Supports both TypeORM and MikroORM based on the configured ORM type.
	 */
	async saveSettings(
		input: Record<string, any>,
		scope: SystemSettingScope,
		tenantId?: ID,
		organizationId?: ID
	): Promise<Record<string, any>> {
		if (!input || !Object.keys(input).length) {
			throw new BadRequestException('At least one setting must be provided.');
		}

		this.validateScope(scope, tenantId, organizationId);

		// Validate all settings before starting transaction
		for (const key of Object.keys(input)) {
			this.validateSettingScope(key, scope);
		}

		const effectiveTenantId = scope === SystemSettingScope.GLOBAL ? null : tenantId;
		const effectiveOrgId = scope === SystemSettingScope.ORGANIZATION ? organizationId : null;

		// Use ORM-specific transaction handling
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				return this.saveSettingsWithMikroORM(input, effectiveTenantId, effectiveOrgId);
			case MultiORMEnum.TypeORM:
			default:
				return this.saveSettingsWithTypeORM(input, effectiveTenantId, effectiveOrgId);
		}
	}

	/**
	 * Saves settings using TypeORM with transactional EntityManager.
	 */
	private async saveSettingsWithTypeORM(
		input: Record<string, any>,
		tenantId: ID | null,
		organizationId: ID | null
	): Promise<Record<string, any>> {
		return await this.dataSource.transaction(async (manager: EntityManager) => {
			const result: Record<string, any> = {};

			for (const [key, val] of Object.entries(input)) {
				// undefined = skip (no change), null = clear to NULL, other = stringify
				if (val === undefined) {
					continue;
				}
				const value = val === null ? null : String(val);
				await this.upsertSettingWithTypeORM(manager, key, value, tenantId, organizationId);
				result[key] = convertSettingValue(value, key);
			}

			return result;
		});
	}

	/**
	 * Saves settings using MikroORM with transactional EntityManager.
	 */
	private async saveSettingsWithMikroORM(
		input: Record<string, any>,
		tenantId: ID | null,
		organizationId: ID | null
	): Promise<Record<string, any>> {
		const em = this.mikroOrmSystemSettingRepository.getEntityManager();

		return await em.transactional(async (transactionalEm) => {
			const result: Record<string, any> = {};

			for (const [key, val] of Object.entries(input)) {
				// undefined = skip (no change), null = clear to NULL, other = stringify
				if (val === undefined) {
					continue;
				}
				const value = val === null ? null : String(val);
				await this.upsertSettingWithMikroORM(transactionalEm, key, value, tenantId, organizationId);
				result[key] = convertSettingValue(value, key);
			}

			return result;
		});
	}

	/**
	 * Gets settings for a specific scope without cascade.
	 */
	async getSettingsByScope(
		scope: SystemSettingScope,
		tenantId?: ID,
		organizationId?: ID
	): Promise<Record<string, any>> {
		this.validateScope(scope, tenantId, organizationId);

		const effectiveTenantId = scope === SystemSettingScope.GLOBAL ? null : tenantId;
		const effectiveOrgId = scope === SystemSettingScope.ORGANIZATION ? organizationId : null;

		const settings = await this.find({
			where: { tenantId: effectiveTenantId ?? IsNull(), organizationId: effectiveOrgId ?? IsNull() }
		});

		return settings.reduce((acc, s) => ({ ...acc, [s.name]: convertSettingValue(s.value, s.name) }), {});
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Private
	// ─────────────────────────────────────────────────────────────────────────────

	private async findByScope(
		name: string,
		tenantId: ID | null,
		organizationId: ID | null
	): Promise<SystemSetting | null> {
		try {
			return await this.findOneByOptions({
				where: { name, tenantId: tenantId ?? IsNull(), organizationId: organizationId ?? IsNull() }
			});
		} catch (error) {
			// Only return null for "not found" errors, rethrow others
			if (error instanceof NotFoundException) {
				return null;
			}
			throw error;
		}
	}

	/**
	 * Performs atomic upsert using TypeORM transactional EntityManager.
	 * Uses save() instead of update() to properly trigger TypeORM's @UpdateDateColumn.
	 *
	 * For MySQL with GLOBAL scope (NULL tenantId/organizationId), performs explicit
	 * duplicate check since MySQL doesn't enforce unique constraints on NULL values.
	 *
	 * @param manager - TypeORM transactional EntityManager
	 * @param name - Setting name
	 * @param value - String to set, or null to clear the setting value
	 * @param tenantId - Tenant ID or null for GLOBAL scope
	 * @param organizationId - Organization ID or null for non-organization scope
	 */
	private async upsertSettingWithTypeORM(
		manager: EntityManager,
		name: string,
		value: string | null,
		tenantId: ID | null,
		organizationId: ID | null
	): Promise<void> {
		const repo = manager.getRepository(SystemSetting);

		// Build where clause for NULL-safe lookup
		const whereClause = {
			name,
			tenantId: tenantId ?? IsNull(),
			organizationId: organizationId ?? IsNull()
		};

		const existing = await repo.findOne({ where: whereClause as any });

		if (existing) {
			// Use save() to properly update TypeORM-managed fields like updatedAt
			existing.value = value;
			await repo.save(existing);
			return;
		}

		// For MySQL GLOBAL settings: explicit duplicate check before insert
		// MySQL's unique constraint doesn't prevent duplicate NULL rows
		if (isMySQL() && tenantId === null && organizationId === null) {
			const duplicateCheck = await repo
				.createQueryBuilder('setting')
				.where('setting.name = :name', { name })
				.andWhere('setting.tenantId IS NULL')
				.andWhere('setting.organizationId IS NULL')
				.setLock('pessimistic_write')
				.getOne();

			if (duplicateCheck) {
				duplicateCheck.value = value;
				await repo.save(duplicateCheck);
				return;
			}
		}

		try {
			const entity = repo.create({ name, value, tenantId, organizationId });
			await repo.insert(entity);
		} catch (error) {
			if (this.isUniqueConstraintError(error)) {
				const existingAfterRace = await repo.findOne({ where: whereClause as any });
				if (existingAfterRace) {
					// Use save() to properly update TypeORM-managed fields like updatedAt
					existingAfterRace.value = value;
					await repo.save(existingAfterRace);
					return;
				}
			}
			throw error;
		}
	}

	/**
	 * Performs atomic upsert using MikroORM transactional EntityManager.
	 *
	 * For MySQL with GLOBAL scope (NULL tenantId/organizationId), performs explicit
	 * duplicate check since MySQL doesn't enforce unique constraints on NULL values.
	 *
	 * @param em - MikroORM transactional EntityManager
	 * @param name - Setting name
	 * @param value - String to set, or null to clear the setting value
	 * @param tenantId - Tenant ID or null for GLOBAL scope
	 * @param organizationId - Organization ID or null for non-organization scope
	 */
	private async upsertSettingWithMikroORM(
		em: any, // MikroORM EntityManager type
		name: string,
		value: string | null,
		tenantId: ID | null,
		organizationId: ID | null
	): Promise<void> {
		// Build filter for MikroORM (handles null values differently)
		const filter: Record<string, any> = { name };
		if (tenantId === null) {
			filter.tenantId = null;
		} else {
			filter.tenantId = tenantId;
		}
		if (organizationId === null) {
			filter.organizationId = null;
		} else {
			filter.organizationId = organizationId;
		}

		const existing = await em.findOne(SystemSetting, filter);

		if (existing) {
			existing.value = value;
			await em.persistAndFlush(existing);
			return;
		}

		// For MySQL GLOBAL settings: explicit duplicate check before insert
		// MySQL's unique constraint doesn't prevent duplicate NULL rows
		if (isMySQL() && tenantId === null && organizationId === null) {
			const duplicateCheck = await em.findOne(
				SystemSetting,
				{ name, tenantId: null, organizationId: null },
				{ lockMode: 2 } // PESSIMISTIC_WRITE
			);

			if (duplicateCheck) {
				duplicateCheck.value = value;
				await em.persistAndFlush(duplicateCheck);
				return;
			}
		}

		try {
			const entity = em.create(SystemSetting, { name, value, tenantId, organizationId });
			await em.persistAndFlush(entity);
		} catch (error) {
			if (this.isMikroORMUniqueConstraintError(error)) {
				const existingAfterRace = await em.findOne(SystemSetting, filter);
				if (existingAfterRace) {
					existingAfterRace.value = value;
					await em.persistAndFlush(existingAfterRace);
					return;
				}
			}
			throw error;
		}
	}

	/**
	 * Checks if an error is a MikroORM unique constraint violation.
	 */
	private isMikroORMUniqueConstraintError(error: unknown): boolean {
		const message = (error as any)?.message?.toLowerCase() ?? '';
		const code = (error as any)?.code ?? '';

		// PostgreSQL: 23505, MySQL: ER_DUP_ENTRY (1062), SQLite: SQLITE_CONSTRAINT (19)
		return (
			code === '23505' ||
			code === 'ER_DUP_ENTRY' ||
			code === '1062' ||
			code === 'SQLITE_CONSTRAINT' ||
			code === '19' ||
			message.includes('unique constraint') ||
			message.includes('duplicate key') ||
			message.includes('duplicate entry') ||
			message.includes('unique_violation')
		);
	}

	/**
	 * Checks if an error is a unique constraint violation.
	 */
	private isUniqueConstraintError(error: unknown): boolean {
		if (error instanceof QueryFailedError) {
			const message = error.message?.toLowerCase() ?? '';
			const driverError = (error as any).driverError;
			const code = driverError?.code ?? '';

			// PostgreSQL: 23505, MySQL: ER_DUP_ENTRY (1062), SQLite: SQLITE_CONSTRAINT (19)
			return (
				code === '23505' ||
				code === 'ER_DUP_ENTRY' ||
				code === '1062' ||
				code === 'SQLITE_CONSTRAINT' ||
				code === '19' ||
				message.includes('unique constraint') ||
				message.includes('duplicate key') ||
				message.includes('duplicate entry') ||
				message.includes('unique_violation')
			);
		}
		return false;
	}

	private async findByNamesAndScope(
		names: string[],
		tenantId: ID | null,
		organizationId: ID | null
	): Promise<SystemSetting[]> {
		if (!names.length) return [];
		return this.find({
			where: { name: In(names), tenantId: tenantId ?? IsNull(), organizationId: organizationId ?? IsNull() }
		});
	}

	private resolveEnvOrDefault(name: string): { value: any; source: 'ENV' | 'DEFAULT' } {
		const envVarName = getEnvVarName(name);
		if (envVarName) {
			const envValue = this.configService.get(envVarName);
			if (envValue !== null && envValue !== undefined) {
				return { value: convertSettingValue(String(envValue), name), source: 'ENV' };
			}
		}
		const defaultValue = getDefaultValue(name);
		return {
			value:
				defaultValue !== null && defaultValue !== undefined
					? convertSettingValue(String(defaultValue), name)
					: undefined,
			source: 'DEFAULT'
		};
	}

	private validateScope(scope: SystemSettingScope, tenantId?: ID, organizationId?: ID): void {
		if (scope === SystemSettingScope.ORGANIZATION && (!tenantId || !organizationId)) {
			throw new BadRequestException('tenantId and organizationId are required for ORGANIZATION scope');
		}
		if (scope === SystemSettingScope.TENANT && !tenantId) {
			throw new BadRequestException('tenantId is required for TENANT scope');
		}
	}

	private validateSettingScope(key: string, scope: SystemSettingScope): void {
		const metadata = getSettingMetadata(key);
		if (metadata && !metadata.allowedScopes.includes(scope)) {
			throw new BadRequestException(
				`Setting "${key}" cannot be defined at ${scope} level. Allowed: ${metadata.allowedScopes.join(', ')}`
			);
		}
	}
}
