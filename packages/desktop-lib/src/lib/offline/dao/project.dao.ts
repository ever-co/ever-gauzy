import { DAO, IDatabaseProvider } from '../../interfaces';
import { ProjectTO, TABLE_NAME_PROJECTS } from '../dto';
import { ProjectTransaction } from '../transactions';
import { ProviderFactory } from '../databases';

export class ProjectDAO implements DAO<ProjectTO> {
	private _provider: IDatabaseProvider;
	private _trx: ProjectTransaction;

	constructor() {
		this._provider = ProviderFactory.instance;
		this._trx = new ProjectTransaction(this._provider);
	}

	public async findAll(): Promise<ProjectTO[]> {
		return await this._provider
			.connection<ProjectTO>(TABLE_NAME_PROJECTS)
			.select('*');
	}
	public async save(value: ProjectTO): Promise<void> {
		await this._trx.create(value);
	}
	public async findOneById(id: number): Promise<ProjectTO> {
		return await this._provider
			.connection<ProjectTO>(TABLE_NAME_PROJECTS)
			.select('*')
			.where('id', '=', id)[0];
	}
	public async update(id: number, value: Partial<ProjectTO>): Promise<void> {
		await this._trx.update(id, value);
	}
	public async delete(value: Partial<ProjectTO>): Promise<void> {
		await this._provider
			.connection<ProjectTO>(TABLE_NAME_PROJECTS)
			.where('id', '=', value.id)
			.del();
	}

	public async findByClient(clientId: number): Promise<ProjectTO[]> {
		return await this._provider
			.connection<ProjectTO>(TABLE_NAME_PROJECTS)
			.select('*')
			.where('contactId', '=', clientId);
	}
}
