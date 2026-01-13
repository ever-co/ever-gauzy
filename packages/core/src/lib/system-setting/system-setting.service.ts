import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager, In, IsNull, QueryFailedError } from 'typeorm';
import { ID, IResolvedSystemSetting, SystemSettingScope } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud';
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
		private readonly typeOrmSystemSettingRepository: TypeOrmSystemSettingRepository,
		private readonly mikroOrmSystemSettingRepository: MikroOrmSystemSettingRepository,
		private readonly configService: ConfigService,
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

		return await this.dataSource.transaction(async (manager: EntityManager) => {
			const result: Record<string, any> = {};

			for (const [key, val] of Object.entries(input)) {
				// undefined = skip (no change), null = clear to NULL, other = stringify
				if (val === undefined) {
					continue;
				}
				const value = val === null ? null : String(val);
				await this.upsertSettingWithManager(manager, key, value, effectiveTenantId, effectiveOrgId);
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
	 * Performs atomic upsert using the transactional EntityManager.
	 * @param value - string to set, or null to clear the setting value
	 */
	private async upsertSettingWithManager(
		manager: EntityManager,
		name: string,
		value: string | null,
		tenantId: ID | null,
		organizationId: ID | null
	): Promise<void> {
		const repo = manager.getRepository(SystemSetting);
		const whereClause = {
			name,
			tenantId: tenantId ?? IsNull(),
			organizationId: organizationId ?? IsNull()
		};

		const existing = await repo.findOne({ where: whereClause as any });

		if (existing) {
			await repo.update(existing.id, { value });
			return;
		}

		try {
			const entity = repo.create({ name, value, tenantId, organizationId });
			await repo.insert(entity);
		} catch (error) {
			if (this.isUniqueConstraintError(error)) {
				const existingAfterRace = await repo.findOne({ where: whereClause as any });
				if (existingAfterRace) {
					await repo.update(existingAfterRace.id, { value });
					return;
				}
			}
			throw error;
		}
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
