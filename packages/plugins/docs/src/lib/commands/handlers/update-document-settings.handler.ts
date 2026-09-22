import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IDocumentSettings } from '../../dto/document-settings.dto';
import { DocumentSettingsService } from '../../services/document-settings.service';
import { UpdateDocumentSettingsCommand } from '../update-document-settings.command';

@CommandHandler(UpdateDocumentSettingsCommand)
export class UpdateDocumentSettingsHandler implements ICommandHandler<UpdateDocumentSettingsCommand> {
	constructor(private readonly documentSettingsService: DocumentSettingsService) {}

	/**
	 * Handles the `UpdateDocumentSettingsCommand`: partial update of the org-defaults block.
	 *
	 * @param command - The command carrying the organization id and defaults payload.
	 * @returns The updated settings envelope.
	 */
	public async execute(command: UpdateDocumentSettingsCommand): Promise<IDocumentSettings> {
		return this.documentSettingsService.updateSettings(command.organizationId, command.input);
	}
}
