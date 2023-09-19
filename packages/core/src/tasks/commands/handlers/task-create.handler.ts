import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ITask } from '@gauzy/contracts';
import { RequestContext } from './../../../core/context';
import { TaskCreateCommand } from './../task-create.command';
import { OrganizationProjectService } from './../../../organization-project/organization-project.service';
import { TaskService } from '../../task.service';
import { GitHubService } from './../../../github/github.service';

@CommandHandler(TaskCreateCommand)
export class TaskCreateHandler implements ICommandHandler<TaskCreateCommand> {
	constructor(
		// TODO:
		// Uncomment below line for GitHub app integration
		private readonly _gitHubService: GitHubService,
		private readonly _taskService: TaskService,
		private readonly _organizationProjectService: OrganizationProjectService
	) { }

	public async execute(command: TaskCreateCommand): Promise<ITask> {
		try {
			const { input } = command;
			const tenantId = RequestContext.currentTenantId() || input.tenantId;

			let { organizationId, project } = input;

			/** If project found then use project name as a task prefix */
			if (input.projectId) {
				const { projectId } = input;
				project =
					await this._organizationProjectService.findOneByIdString(
						projectId
					);
			}

			const projectId = project ? project.id : null;
			const taskPrefix = project ? project.name.substring(0, 3) : null;

			const maxNumber = await this._taskService.getMaxTaskNumberByProject(
				{
					organizationId,
					projectId,
				}
			);

			// TODO:
			// Make the Repo, Owner and installation id field dynamic
			// this._gitHubService.openIssue(
			// 	input.title,
			// 	input.description,
			// 	'<OWNER>',
			// 	'<REPO>',
			// 	12345678 // installation id
			// );

			return await this._taskService.create({
				...input,
				number: maxNumber + 1,
				prefix: taskPrefix,
				tenantId,
				organizationId,
			});
		} catch (error) {
			console.log('Error while creating task %s', error?.message);
			throw new HttpException({ message: error?.message, error }, HttpStatus.BAD_REQUEST);
		}
	}
}
