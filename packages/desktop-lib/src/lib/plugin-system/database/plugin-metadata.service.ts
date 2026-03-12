import { IDatabaseProvider } from '../../interfaces';
import { ProviderFactory } from '../../offline';
import {
    IPluginMetadataCreate,
    IPluginMetadataDelete,
    IPluginMetadataFindOne,
    IPluginMetadataPersistance,
    IPluginMetadataUpdate,
    TABLE_PLUGINS
} from '../shared';

export class PluginMetadataService {
	private readonly db: IDatabaseProvider = ProviderFactory.instance;

	/**
	 * Apply a user-scoped filter: matches rows where userId is NULL (global) or equals the given userId.
	 */
	private applyUserFilter(builder: import('knex').Knex.QueryBuilder, userId: string): import('knex').Knex.QueryBuilder {
		return builder.whereNull('userId').orWhere('userId', userId);
	}

	public async create(input: IPluginMetadataCreate): Promise<void> {
		await this.db.connection<IPluginMetadataCreate>(TABLE_PLUGINS).insert(input);
	}

	public async update(input: IPluginMetadataUpdate): Promise<void> {
		const query = this.buildQuery(input);
		await query.update(input);
	}

	public async delete(input: IPluginMetadataDelete): Promise<void> {
		const query = this.buildQuery(input);
		await query.del();
	}

	public async findAll(): Promise<IPluginMetadataPersistance[]> {
		return this.db.connection<IPluginMetadataPersistance>(TABLE_PLUGINS).select('*');
	}

	public async findOne(input: IPluginMetadataFindOne): Promise<IPluginMetadataPersistance> {
		const query = this.buildQuery(input);
		return query.first();
	}

	public async findActivated(): Promise<IPluginMetadataPersistance[]> {
		return this.db.connection<IPluginMetadataPersistance>(TABLE_PLUGINS).select('*').where('isActivate', true);
	}

	public async findAllForUser(userId: string): Promise<IPluginMetadataPersistance[]> {
		return this.db
			.connection<IPluginMetadataPersistance>(TABLE_PLUGINS)
			.select('*')
			.where((builder) => this.applyUserFilter(builder, userId));
	}

	public async findActivatedForUser(userId: string): Promise<IPluginMetadataPersistance[]> {
		return this.db
			.connection<IPluginMetadataPersistance>(TABLE_PLUGINS)
			.select('*')
			.where('isActivate', true)
			.where((builder) => this.applyUserFilter(builder, userId));
	}

	public async updateTenantEnabled(marketplaceId: string, tenantEnabled: boolean): Promise<void> {
		await this.db
			.connection<IPluginMetadataPersistance>(TABLE_PLUGINS)
			.where('marketplaceId', marketplaceId)
			.update({ tenantEnabled });
	}

	private buildQuery(input: { id?: string; name?: string; marketplaceId?: string }) {
		const query = this.db.connection<IPluginMetadataPersistance>(TABLE_PLUGINS).select('*');

		if (input.id) {
			query.where('id', input.id);
		}

		if (input.name) {
			query.where('name', input.name);
		}

		if (input.marketplaceId) {
			query.where('marketplaceId', input.marketplaceId);
		}

		return query;
	}
}
