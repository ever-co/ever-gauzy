import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { CamshotService } from '../../services/camshot.service';
import { DeleteCamshotCommand } from '../delete-camshot.command';
import { NotFoundException } from '@nestjs/common';
import { RequestContext } from '@gauzy/core';

@CommandHandler(DeleteCamshotCommand)
export class DeleteCamshotCommandHandler implements ICommandHandler<DeleteCamshotCommand> {
	constructor(private readonly camshotService: CamshotService) {}

	/**
	 * Handles the `DeleteCamshotCommand` to delete a camshot entity from the database.
	 * Validates the existence of the camshot and performs the deletion based on the provided criteria.
	 *
	 * @param command - The `DeleteCamshotCommand` containing the camshot ID and additional options for deletion.
	 *
	 * @returns A promise that resolves when the camshot is successfully deleted.
	 *
	 * @throws {NotFoundException} If the camshot with the specified ID does not exist.
	 */
	public async execute(command: DeleteCamshotCommand): Promise<void> {
		const { id, input } = command;
		const { forceDelete = false, organizationId, tenantId = RequestContext.currentTenantId() } = input;
		const camshot = await this.camshotService.findOneByOptions({
			where: { id, organizationId, tenantId },
			withDeleted: true
		});

		if (!camshot) {
			throw new NotFoundException(`Cannot delete because camshot with id ${id} not found`);
		}

		if (forceDelete) {
			await this.camshotService.delete(id, { withDeleted: true });
		} else {
			await this.camshotService.softDelete(id);
		}
	}
}
