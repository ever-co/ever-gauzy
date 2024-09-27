import { HttpException, HttpStatus } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IOrganizationProject } from '@gauzy/contracts';
import { OrganizationProjectCreateCommand } from '../organization-project-create.command';
import { OrganizationProjectService } from '../../organization-project.service';
import { OrganizationProjectStatusBulkCreateCommand } from '../../../tasks/statuses/commands';
import { OrganizationProjectTaskPriorityBulkCreateCommand } from '../../../tasks/priorities/commands';
import { OrganizationProjectTaskSizeBulkCreateCommand } from '../../../tasks/sizes/commands';
import { OrganizationProjectIssueTypeBulkCreateCommand } from '../../../tasks/issue-type/commands';

@CommandHandler(OrganizationProjectCreateCommand)
export class OrganizationProjectCreateHandler implements ICommandHandler<OrganizationProjectCreateCommand> {
	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _organizationProjectService: OrganizationProjectService
	) {}

	/**
	 * Executes the creation of an organization project along with its associated task statuses,
	 * task priorities, task sizes, and issue types.
	 *
	 * @param {OrganizationProjectCreateCommand} command - The command containing the input data for creating the organization project.
	 * @returns {Promise<IOrganizationProject>} - Returns a promise that resolves with the created organization project.
	 *
	 * @throws {BadRequestException} - Throws a BadRequestException if an error occurs during the process.
	 */
	public async execute(command: OrganizationProjectCreateCommand): Promise<IOrganizationProject> {
		try {
			// Destructure the input data from the command
			const { input } = command;

			// Create the organization project using the input data
			const project = await this._organizationProjectService.create(input);

			// Initialize associated entities for the created project
			this.createAssociatedEntitiesForProject(project);

			// Return the created organization project
			return project;
		} catch (error) {
			// Handle errors and return an appropriate error response
			console.error('Error during organization project creation:', error);
			throw new HttpException(`Failed to create organization project: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * Creates associated entities (task statuses, priorities, sizes, and issue types) for the organization project.
	 *
	 * @param {IOrganizationProject} project - The organization project for which associated entities will be created.
	 * @returns {Promise<void>} - Returns a promise indicating the completion of the associated entities creation.
	 *
	 * @throws {HttpException} - Throws an HttpException if an error occurs during the process.
	 */
	private async createAssociatedEntitiesForProject(project: IOrganizationProject): Promise<void> {
		try {
			console.log('Start: Creating associated entities for project with ID:', project.id);

			// Create task statuses for the newly created organization project
			await this._commandBus.execute(new OrganizationProjectStatusBulkCreateCommand(project));
			console.log('Task statuses created successfully');

			// Create task priorities for the newly created organization project
			await this._commandBus.execute(new OrganizationProjectTaskPriorityBulkCreateCommand(project));
			console.log('Task priorities created successfully');

			// Create task sizes for the newly created organization project
			await this._commandBus.execute(new OrganizationProjectTaskSizeBulkCreateCommand(project));
			console.log('Task sizes created successfully');

			// Create issue types for the newly created organization project
			await this._commandBus.execute(new OrganizationProjectIssueTypeBulkCreateCommand(project));
			console.log('Issue types created successfully');

			console.log('End: Associated entities creation completed for project with ID:', project.id);
		} catch (error) {
			// Handle errors specific to the associated entities creation process
			console.error('Error while creating associated entities for project:', error);
		}
	}
}
