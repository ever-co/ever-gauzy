import { RequestContext } from '@gauzy/core';
import { Injectable, Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { GetPluginTenantUsersQuery } from '../get-plugin-tenant-users.query';

export interface PluginTenantUser {
	id: string;
	firstName?: string;
	lastName?: string;
	email?: string;
	imageUrl?: string;
	accessType: 'allowed' | 'denied';
	assignedAt?: Date;
}

export interface GetPluginTenantUsersResult {
	items: PluginTenantUser[];
	total: number;
}

@QueryHandler(GetPluginTenantUsersQuery)
@Injectable()
export class GetPluginTenantUsersHandler implements IQueryHandler<GetPluginTenantUsersQuery> {
	private readonly logger = new Logger(GetPluginTenantUsersHandler.name);

	constructor(private readonly dataSource: DataSource) {}

	public async execute(query: GetPluginTenantUsersQuery): Promise<GetPluginTenantUsersResult> {
		const { pluginTenantId, userType, skip = 0, take = 20, searchTerm } = query;
		const currentUserId = RequestContext.currentUserId();

		this.logger.log(`Getting ${userType} users for plugin tenant ${pluginTenantId}`);

		// ---------- WHERE & PARAMS ----------
		const params: (string | number)[] = [pluginTenantId, currentUserId];
		let searchClause = '';

		if (searchTerm) {
			params.push(`%${searchTerm.toLowerCase()}%`);
			searchClause = `
				AND (
					LOWER(u."firstName") LIKE $${params.length}
					OR LOWER(u."lastName") LIKE $${params.length}
					OR LOWER(u."email") LIKE $${params.length}
				)
			`;
		}

		// ---------- BASE QUERIES ----------
		const allowedQuery = `
			SELECT DISTINCT
				u.id,
				u."firstName",
				u."lastName",
				u.email,
				u."imageUrl",
				pt."createdAt" AS "assignedAt",
				'allowed'::text AS "accessType"
			FROM plugin_tenant_allowed_users ptau
			JOIN "user" u ON u.id = ptau."userId"
			JOIN "plugin_tenants" pt ON pt.id = ptau."pluginTenantsId"
			WHERE ptau."pluginTenantsId" = $1 AND u.id <> $2
			${searchClause}
		`;

		const deniedQuery = `
			SELECT DISTINCT
				u.id,
				u."firstName",
				u."lastName",
				u.email,
				u."imageUrl",
				pt."createdAt" AS "assignedAt",
				'denied'::text AS "accessType",
			FROM plugin_tenant_allowed_users ptau
			JOIN "user" u ON u.id = ptau."userId"
			JOIN "plugin_tenants" pt ON pt.id = ptau."pluginTenantsId"
			WHERE ptau."pluginTenantsId" = $1 AND u.id <> $2
			${searchClause}
		`;

		let unionQuery = '';
		if (userType === 'allowed') {
			unionQuery = allowedQuery;
		} else if (userType === 'denied') {
			unionQuery = deniedQuery;
		} else {
			unionQuery = `
				${allowedQuery}
				UNION ALL
				${deniedQuery}
			`;
		}

		// ---------- TOTAL ----------
		const totalSql = `
			SELECT COUNT(*)::int AS total
			FROM (${unionQuery}) t
		`;

		const [{ total }] = await this.dataSource.query(totalSql, params);

		if (total === 0) {
			return { items: [], total: 0 };
		}

		// ---------- PAGINATED DATA ----------
		params.push(take, skip);

		const dataSql = `
			SELECT *
			FROM (${unionQuery}) t
			ORDER BY "assignedAt" DESC NULLS LAST
			LIMIT $${params.length - 1}
			OFFSET $${params.length}
		`;

		const items: PluginTenantUser[] = await this.dataSource.query(dataSql, params);

		return {
			items,
			total
		};
	}
}
