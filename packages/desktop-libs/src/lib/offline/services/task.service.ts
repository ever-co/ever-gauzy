import { ITaskFilterOption, ITaskService } from '../../interfaces';
import { TaskDAO } from '../dao';
import { TaskTO } from '../dto';

export class TaskService implements ITaskService<TaskTO> {
	private _taskDAO: TaskDAO;
	constructor() {
		this._taskDAO = new TaskDAO();
	}
	public async save(task: TaskTO): Promise<void> {
		await this._taskDAO.save(task);
	}
	public async findAll(): Promise<TaskTO[]> {
		return await this._taskDAO.findAll();
	}
	public async findById(task: Partial<TaskTO>): Promise<TaskTO> {
		return await this._taskDAO.findOneById(task.id);
	}
	public async findByOption(options: ITaskFilterOption): Promise<TaskTO[]> {
		return await this._taskDAO.findByOptions(options);
	}
	public async remove(task: Partial<TaskTO>): Promise<void> {
		await this._taskDAO.delete(task);
	}
}
