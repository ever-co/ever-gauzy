import { HttpException, HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITask, ITaskUpdateInput } from '@gauzy/contracts';
import { TaskService } from '../../task.service';
import { TaskUpdateCommand } from '../task-update.command';
import { OctokitService } from 'octokit/octokit.service';
import { GitHubService } from 'github/github.service';

@CommandHandler(TaskUpdateCommand)
export class TaskUpdateHandler implements ICommandHandler<TaskUpdateCommand> {
	constructor(
		private readonly _taskService: TaskService,
		private readonly _octokitService: OctokitService,
		// TODO:
		// Uncomment below line for GitHub app integration
		private readonly _gitHubService: GitHubService
	) { }

	public async execute(command: TaskUpdateCommand): Promise<ITask> {
		const { id, input } = command;
		return await this.update(id, input);
	}

	/**
	 * Update task, if already exist
	 *
	 * @param id
	 * @param request
	 * @returns
	 */
	public async update(id: string, request: ITaskUpdateInput): Promise<ITask> {
		try {
			const task = await this._taskService.findOneByIdString(id);

			if (request.projectId) {
				const { projectId } = request;
				/**
				 * If, project changed for task, just update latest task number
				 */
				if (projectId !== task.projectId) {
					const { organizationId } = task;
					const maxNumber =
						await this._taskService.getMaxTaskNumberByProject({
							organizationId,
							projectId,
						});
					await this._taskService.update(id, {
						projectId,
						number: maxNumber + 1,
					});
				}
			}

			// TODO:
			// We have to store issue_number of github in our task, so that we can use it while sync
			// Right now we we have put static 38 value.
			this._octokitService.updateIssue(
				38,
				request.title,
				request.description
			);
			// Make the Issue number, Repo, Owner and installation id field dynamic
			// this._gitHubService.editIssue(
			// 	48,
			// 	task.title,
			// 	task.description,
			// 	'<OWNER>',
			// 	'<REPO>',
			// 	12345678 // installation id
			// );

			return await this._taskService.create({
				...request,
				id,
			});
		} catch (error) {
			console.log('Error while updating task %s', error?.message);
			throw new HttpException({ message: error?.message, error }, HttpStatus.BAD_REQUEST);
		}
	}
}
