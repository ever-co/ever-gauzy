import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { CommandBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { RequestContext } from 'core/context';
import { GithubTaskUpdateOrCreateCommand } from 'integration/github/commands';
import { TaskUpdatedEvent } from '../task-updated.event';

// Handles event when new task created
@EventsHandler(TaskUpdatedEvent)
export class TaskUpdatedEventHandler implements IEventHandler<TaskUpdatedEvent> {
    private readonly logger = new Logger('TaskUpdatedEvent');

    constructor(
        private readonly _commandBus: CommandBus
    ) { }

    /**
     * Handles a `TaskUpdatedEvent` by processing the event's input and executing a command if a project ID is present.
     *
     * @param event - The `TaskUpdatedEvent` to handle.
     */
    async handle(event: TaskUpdatedEvent) {
        try {
            const { input } = event;
            const { organizationId, projectId } = input;
            const tenantId = RequestContext.currentTenantId() || input.tenantId;

            // If project found
            if (projectId) {
                // Prepare a payload for the command
                const payload = {
                    tenantId,
                    organizationId,
                    projectId
                };
                await this._commandBus.execute(
                    new GithubTaskUpdateOrCreateCommand(input, payload)
                );
            }
        } catch (error) {
            // Handle errors and return an appropriate error response
            this.logger.error('Error while updating of existing task', error.message);
            throw new HttpException(`Error while updating of existing task: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
