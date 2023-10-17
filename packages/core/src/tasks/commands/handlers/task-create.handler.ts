import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ITask } from '@gauzy/contracts';
import { RequestContext } from './../../../core/context';
import { TaskCreateCommand } from './../task-create.command';
import { OrganizationProjectService } from './../../../organization-project/organization-project.service';
import { TaskService } from '../../task.service';
import { GithubService } from '../../../integration/github/github.service';

@CommandHandler(TaskCreateCommand)
export class TaskCreateHandler implements ICommandHandler<TaskCreateCommand> {
	private readonly logger = new Logger('TaskCreateHandler');

	constructor(
		private readonly _taskService: TaskService,
		private readonly _organizationProjectService: OrganizationProjectService,

		private readonly _githubService: GithubService
	) {}

	public async execute(command: TaskCreateCommand): Promise<ITask> {
		try {
			const { input } = command;
			let { organizationId, project } = input;
			const tenantId = RequestContext.currentTenantId() || input.tenantId;

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
					tenantId,
					organizationId,
					projectId,
				}
			);

			console.log('project', project);

			if (project && project.externalRepositoryId) {
				this._githubService.openIssue({
					title: input.title,
					body: input.description,
					owner: 'badalkhatri0924',
					installationId: 42942950,
					// repo: `${project.externalRepositoryId}`,
					repo: 'badal-ever-testing-probot',
				});
			}

			return await this._taskService.create({
				...input,
				number: maxNumber + 1,
				prefix: taskPrefix,
				tenantId,
				organizationId,
			});
		} catch (error) {
			this.logger.error(
				`Error while creating task: ${error.message}`,
				error.message
			);
			throw new HttpException(
				{ message: error?.message, error },
				HttpStatus.BAD_REQUEST
			);
		}
	}
}
