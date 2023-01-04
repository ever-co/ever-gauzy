import { IClientFilterOption, IProjectService } from '../../interfaces';
import { ClientDAO, ProjectDAO } from '../dao';
import { ProjectTO } from '../dto';
import { Client } from '../models';

export class ProjectService implements IProjectService<ProjectTO> {
	private _projectDAO: ProjectDAO;
	private _clientDAO: ClientDAO;

	constructor() {
		this._projectDAO = new ProjectDAO();
		this._clientDAO = new ClientDAO();
	}
	public async save(project: ProjectTO): Promise<void> {
		await this._projectDAO.save(project);
	}
	public async findAll(): Promise<ProjectTO[]> {
		return await this._projectDAO.findAll();
	}
	public async findOne(project: Partial<ProjectTO>): Promise<ProjectTO> {
		return this._projectDAO.findOneById(project.id);
	}
	public async findByClient(
		options: IClientFilterOption
	): Promise<ProjectTO[]> {
		const client = new Client(
			await this._clientDAO.findOneByOptions(options)
		);
		return await this._projectDAO.findByClient(client.id);
	}
	public async remove(project: Partial<ProjectTO>): Promise<void> {
		return this._projectDAO.delete(project);
	}
}
