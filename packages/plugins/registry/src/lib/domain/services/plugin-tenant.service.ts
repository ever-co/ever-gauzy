import { IPagination, PluginScope } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FindManyOptions, FindOptionsWhere } from 'typeorm';
import { IPluginTenant } from '../../shared/models/plugin-tenant.model';
import { PluginTenant } from '../entities/plugin-tenant.entity';
import { MikroOrmPluginTenantRepository } from '../repositories/tenant/mikro-orm-plugin-tenant.repository';
import { TypeOrmPluginTenantRepository } from '../repositories/tenant/type-orm-plugin-tenant.repository';

@Injectable()
export class PluginTenantService extends TenantAwareCrudService<PluginTenant> {
	private readonly logger = new Logger(PluginTenantService.name);

	constructor(
		public readonly typeOrmPluginTenantRepository: TypeOrmPluginTenantRepository,
		public readonly mikroOrmPluginTenantRepository: MikroOrmPluginTenantRepository
	) {
		super(typeOrmPluginTenantRepository, mikroOrmPluginTenantRepository);
	}

	/**
	 * Find or create a plugin tenant relationship
	 * This ensures that a plugin tenant exists for the given plugin, tenant, and organization
	 *
	 * @param pluginId - The plugin ID
	 * @param tenantId - The tenant ID
	 * @param organizationId - Optional organization ID
	 * @returns The plugin tenant ID
	 */
	async findOrCreate(input: Partial<PluginTenant>): Promise<string> {
		const { pluginId, tenantId, organizationId, scope } = input;
		this.validatePluginTenantInput(pluginId, tenantId);

		// First try to find existing plugin tenant
		const existingPluginTenant = await this.findByPluginAndTenant(pluginId, tenantId, organizationId);
		if (existingPluginTenant) {
			this.logger.debug(`Found existing plugin tenant: ${existingPluginTenant.id}`);
			if (scope && scope !== existingPluginTenant.scope) {
				existingPluginTenant.scope = scope;
				await this.save(existingPluginTenant);
			}
			return existingPluginTenant.id;
		}

		// Get current user Id from context
		const currentUser = RequestContext.currentUser();

		// Create new plugin tenant if not found
		const data: Partial<IPluginTenant> = {
			enabled: true,
			autoInstall: false,
			requiresApproval: true,
			isMandatory: false,
			maxInstallations: null,
			maxActiveUsers: null,
			currentInstallations: 0,
			currentActiveUsers: 0,
			isDataCompliant: true,
			approvedById: currentUser?.id,
			approvedAt: new Date(),
			scope,
			...input
		};

		if (organizationId) {
			data.organizationId = organizationId;
		}

		try {
			const tenant = PluginTenant.create(data);
			tenant.allowUser(currentUser);
			this.logger.log(`Created new plugin tenant: ${tenant.id} for plugin ${pluginId} and tenant ${tenantId}`);
			const { id } = await this.save(tenant);
			return id;
		} catch (error) {
			this.logger.error(`Failed to create plugin tenant for plugin ${pluginId} and tenant ${tenantId}`, error);
			throw new BadRequestException(`Failed to create plugin tenant relationship: ${error.message}`);
		}
	}

	/**
	 * Find plugin tenant by plugin ID and tenant ID
	 *
	 * @param pluginId - The plugin ID
	 * @param tenantId - The tenant ID
	 * @param organizationId - Optional organization ID
	 * @returns The plugin tenant or null if not found
	 */
	async findByPluginAndTenant(
		pluginId: string,
		tenantId: string,
		organizationId?: string
	): Promise<IPluginTenant | null> {
		this.validatePluginTenantInput(pluginId, tenantId);

		const where: FindOptionsWhere<PluginTenant> = {
			pluginId,
			tenantId
		};

		if (organizationId) {
			where.organizationId = organizationId;
		}

		try {
			const result = await this.findOneOrFailByWhereOptions(where);
			// Check if the result was successful before accessing the record
			if (result.success && result.record) {
				return result.record;
			}
			return null;
		} catch {
			return null;
		}
	}

	/**
	 * Find all plugin tenants for a specific plugin
	 *
	 * @param pluginId - The plugin ID
	 * @param relations - Optional relations to include
	 * @param skip - Number of records to skip (for pagination)
	 * @param take - Number of records to take (for pagination)
	 * @returns IPagination of plugin tenants
	 */
	async findByPluginId(
		pluginId: string,
		relations: string[] = [],
		skip?: number,
		take?: number
	): Promise<IPagination<IPluginTenant>> {
		this.validatePluginId(pluginId);

		const result = await this.findAll({
			where: { pluginId },
			relations,
			order: { createdAt: 'DESC' },
			...(skip !== undefined && { skip }),
			...(take !== undefined && { take })
		} as FindManyOptions);

		return result;
	}

	/**
	 * Find all plugin tenants for a specific tenant
	 *
	 * @param tenantId - The tenant ID
	 * @param organizationId - Optional organization ID
	 * @param relations - Optional relations to include
	 * @param skip - Number of records to skip (for pagination)
	 * @param take - Number of records to take (for pagination)
	 * @returns IPagination of plugin tenants
	 */
	async findByTenantId(
		tenantId: string,
		organizationId?: string,
		relations: string[] = [],
		skip?: number,
		take?: number
	): Promise<IPagination<IPluginTenant>> {
		this.validateTenantId(tenantId);

		const where: FindOptionsWhere<PluginTenant> = { tenantId };
		if (organizationId) {
			where.organizationId = organizationId;
		}

		const result = await this.findAll({
			where,
			relations,
			order: { createdAt: 'DESC' },
			...(skip !== undefined && { skip }),
			...(take !== undefined && { take })
		} as FindManyOptions);

		return result;
	}

	/**
	 * Enable plugin for a tenant
	 *
	 * @param pluginTenantId - The plugin tenant ID
	 * @returns Updated plugin tenant
	 */
	async enablePlugin(pluginTenantId: string): Promise<IPluginTenant> {
		const pluginTenant = await this.findOneByIdString(pluginTenantId);
		if (!pluginTenant) {
			throw new NotFoundException(`Plugin tenant with ID "${pluginTenantId}" not found`);
		}

		if (pluginTenant.enabled) {
			this.logger.debug(`Plugin tenant ${pluginTenantId} is already enabled`);
			return pluginTenant;
		}

		await this.update(pluginTenantId, { enabled: true });
		const updated = await this.findOneByIdString(pluginTenantId);

		this.logger.log(`Plugin tenant enabled: ${pluginTenantId}`);
		return updated;
	}

	/**
	 * Disable plugin for a tenant
	 *
	 * @param pluginTenantId - The plugin tenant ID
	 * @returns Updated plugin tenant
	 */
	async disablePlugin(pluginTenantId: string): Promise<IPluginTenant> {
		const { success, record: pluginTenant } = await this.findOneOrFailByIdString(pluginTenantId);
		if (!success) {
			throw new NotFoundException(`Plugin tenant with ID "${pluginTenantId}" not found`);
		}

		if (!pluginTenant.enabled) {
			this.logger.debug(`Plugin tenant ${pluginTenantId} is already disabled`);
			return pluginTenant;
		}

		await this.update(pluginTenantId, { enabled: false });
		const { record: updated } = await this.findOneOrFailByIdString(pluginTenantId);

		this.logger.log(`Plugin tenant disabled: ${pluginTenantId}`);
		return updated;
	}

	/**
	 * Update plugin scope for a tenant
	 *
	 * @param pluginTenantId - The plugin tenant ID
	 * @param scope - The new scope
	 * @returns Updated plugin tenant
	 */
	async updateScope(pluginTenantId: string, scope: PluginScope): Promise<IPluginTenant> {
		const { success } = await this.findOneOrFailByIdString(pluginTenantId);
		if (!success) {
			throw new NotFoundException(`Plugin tenant with ID "${pluginTenantId}" not found`);
		}

		await this.update(pluginTenantId, { scope });
		const { record: updated } = await this.findOneOrFailByIdString(pluginTenantId);

		this.logger.log(`Plugin tenant scope updated: ${pluginTenantId} to ${scope}`);
		return updated;
	}

	/**
	 * Check if plugin is enabled for a tenant
	 *
	 * @param pluginId - The plugin ID
	 * @param tenantId - The tenant ID
	 * @param organizationId - Optional organization ID
	 * @returns True if plugin is enabled, false otherwise
	 */
	async isPluginEnabled(pluginId: string, tenantId: string, organizationId?: string): Promise<boolean> {
		const pluginTenant = await this.findByPluginAndTenant(pluginId, tenantId, organizationId);
		return pluginTenant ? pluginTenant.enabled : false;
	}

	/**
	 * Delete plugin tenant relationship
	 *
	 * @param pluginTenantId - The plugin tenant ID
	 */
	async deletePluginTenant(pluginTenantId: string): Promise<void> {
		const { success } = await this.findOneOrFailByIdString(pluginTenantId);

		if (!success) {
			throw new NotFoundException(`Plugin tenant with ID "${pluginTenantId}" not found`);
		}

		await this.delete(pluginTenantId);
		this.logger.log(`Plugin tenant deleted: ${pluginTenantId}`);
	}

	/**
	 * Validate plugin tenant input
	 *
	 * @param pluginId - The plugin ID
	 * @param tenantId - The tenant ID
	 */
	private validatePluginTenantInput(pluginId: string, tenantId: string): void {
		this.validatePluginId(pluginId);
		this.validateTenantId(tenantId);
	}

	/**
	 * Validate plugin ID
	 *
	 * @param pluginId - The plugin ID
	 */
	private validatePluginId(pluginId: string): void {
		if (!pluginId || pluginId.trim().length === 0) {
			throw new BadRequestException('Plugin ID is required and cannot be empty');
		}
	}

	/**
	 * Validate tenant ID
	 *
	 * @param tenantId - The tenant ID
	 */
	private validateTenantId(tenantId: string): void {
		if (!tenantId || tenantId.trim().length === 0) {
			throw new BadRequestException('Tenant ID is required and cannot be empty');
		}
	}

	public exists(pluginTenantId: string): Promise<boolean> {
		return this.exists(pluginTenantId);
	}
}
