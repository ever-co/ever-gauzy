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
		await this.db
			.connection<IPluginMetadataUpdate>(TABLE_PLUGINS)
			.where('id', input.id)
			.orWhere('name', input.name)
			.update({ isActivate: input.isActivate, version: input.version });
	}

	public async delete(input: IPluginMetadataDelete): Promise<void> {
		await this.db
			.connection<IPluginMetadataUpdate>(TABLE_PLUGINS)
			.where('id', input.id)
			.orWhere('name', input.name)
			.del();
	}

	public async findAll(): Promise<IPluginMetadataPersistance[]> {
		return this.db.connection<IPluginMetadataPersistance>(TABLE_PLUGINS).select('*');
	}

	public async findOne(input: IPluginMetadataFindOne): Promise<IPluginMetadataPersistance> {
		const result = await this.db
			.connection<IPluginMetadataPersistance>(TABLE_PLUGINS)
			.select('*')
			.where('id', input.id)
			.orWhere('name', input.name)
			.first();

		if (!result) {
			throw new Error('Plugin metadata not found');
		}

		return result;
	}

	public async findActivated(): Promise<IPluginMetadataPersistance[]> {
		return this.db.connection<IPluginMetadataPersistance>(TABLE_PLUGINS).select('*').where('isActivate', '=', true);
	}
}
