import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { SoundshotService } from '../../services/soundshot.service';
import { DeleteSoundshotCommand } from '../delete-soundshot.command';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RequestContext } from '@gauzy/core';

@CommandHandler(DeleteSoundshotCommand)
export class DeleteSoundshotCommandHandler implements ICommandHandler<DeleteSoundshotCommand> {
	constructor(private readonly soundshotService: SoundshotService) {}

	/**
	 * Handles the `DeleteSoundshotCommand` to delete a soundshot entity from the database.
	 * Validates the existence of the soundshot and performs the deletion based on the provided criteria.
	 *
	 * @param command - The `DeleteSoundshotCommand` containing the soundshot ID and additional options for deletion.
	 *
	 * @returns A promise that resolves when the soundshot is successfully deleted.
	 *
	 * @throws {NotFoundException} If the soundshot with the specified ID does not exist.
	 */
	public async execute(command: DeleteSoundshotCommand): Promise<void> {
		const { id, input } = command;
		const { forceDelete = false, organizationId, tenantId = RequestContext.currentTenantId() } = input;

		if (!tenantId) {
			throw new BadRequestException(`Tenant ID ${tenantId} is required for deleting soundshot.`);
		}

		const soundshot = await this.soundshotService.findOneByOptions({
			where: { id, organizationId, tenantId },
			withDeleted: true
		});

		if (!soundshot) {
			throw new NotFoundException(`Soundshot with ID ${id} not found`);
		}

		if (forceDelete) {
			await this.soundshotService.delete(id);
		} else {
			await this.soundshotService.softDelete(id);
		}
	}
}
