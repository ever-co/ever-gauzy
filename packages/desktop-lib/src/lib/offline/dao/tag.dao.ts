import { DAO, IDatabaseProvider } from '../../interfaces';
import { ProviderFactory } from '../databases';
import { TABLE_NAME_TAGS, TagTO } from '../dto';

export class TagDAO implements DAO<TagTO> {
	private _provider: IDatabaseProvider;

	constructor() {
		this._provider = ProviderFactory.instance;
	}

	public async findAll(): Promise<TagTO[]> {
		return await this._provider
			.connection<TagTO>(TABLE_NAME_TAGS)
			.select('*');
	}
	public async save(value: TagTO): Promise<void> {
		await this._provider.connection<TagTO>(TABLE_NAME_TAGS).insert(value);
	}
	public async findOneById(id: number): Promise<TagTO> {
		return await this._provider
			.connection<TagTO>(TABLE_NAME_TAGS)
			.select('*')
			.where('id', id)[0];
	}
	public async update(id: number, value: Partial<TagTO>): Promise<void> {
		await this._provider
			.connection<TagTO>(TABLE_NAME_TAGS)
			.where('id', '=', id)
			.update(value);
	}
	public async delete(value: Partial<TagTO>): Promise<void> {
		await this._provider
			.connection(TABLE_NAME_TAGS)
			.where('id', '=', value.id)
			.del();
	}
}
