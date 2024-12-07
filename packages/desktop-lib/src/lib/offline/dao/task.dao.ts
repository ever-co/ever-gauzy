import { DAO, IDatabaseProvider, ITaskFilterOption, ITaskTransaction } from '../../interfaces';
import { ProviderFactory } from '../databases';
import { TABLE_NAME_TASKS, TaskTO } from '../dto';
import { TaskTransaction } from '../transactions';

export class TaskDAO implements DAO<TaskTO> {
	private _trx: ITaskTransaction;
	private _provider: IDatabaseProvider;

	constructor() {
		this._provider = ProviderFactory.instance;
		this._trx = new TaskTransaction(this._provider);
	}

	public async findAll(): Promise<TaskTO[]> {
		return await this._provider
			.connection<TaskTO>(TABLE_NAME_TASKS)
			.select('*');
	}
	public async save(value: TaskTO): Promise<void> {
		await this._trx.create(value);
	}
	public async findOneById(id: number): Promise<TaskTO> {
		return await this._provider
			.connection<TaskTO>(TABLE_NAME_TASKS)
			.select('*')
			.where('id', '=', id)[0];
	}
	public async update(id: number, value: Partial<TaskTO>): Promise<void> {
		await this._trx.update(id, value);
	}
	public async delete(value: Partial<TaskTO>): Promise<void> {
		await this._provider
			.connection<TaskTO>(TABLE_NAME_TASKS)
			.where('id', '=', value.id)
			.del();
	}

	public async findByOptions(options: ITaskFilterOption): Promise<TaskTO[]> {
		const { projectId, id, clientId } = options;
		return this._provider
			.connection(TABLE_NAME_TASKS)
			.where('id', '=', id)
			.orWhere('clientId', '=', clientId)
			.orWhere('projectId', '=', projectId)[0];
	}
}
