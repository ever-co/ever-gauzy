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

	public async create(input: IPluginMetadataCreate): Promise<void> {
		await this.db.connection<IPluginMetadataCreate>(TABLE_PLUGINS).insert(input);
	}

	public async update(input: IPluginMetadataUpdate): Promise<void> {
		const query = this.buildQuery(input);
		await query.update({ isActivate: input.isActivate, version: input.version });
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
		const result = await query.first();
		if (!result) {
			throw new Error(`Plugin metadata not found for input: ${JSON.stringify(input)}`);
		}
		return result;
	}

	public async findActivated(): Promise<IPluginMetadataPersistance[]> {
		return this.db.connection<IPluginMetadataPersistance>(TABLE_PLUGINS).select('*').where('isActivate', true);
	}

	private buildQuery(input: { id?: string; name?: string }) {
		const query = this.db.connection<IPluginMetadataPersistance>(TABLE_PLUGINS).select('*');
		if (input.id) {
			query.where('id', input.id);
		}
		if (input.name) {
			if (input.id) {
				query.orWhere('name', input.name);
			} else {
				query.where('name', input.name);
			}
		}
		return query;
	}
}
