import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IOrganization, ITag, ITagCreateInput, ITagUpdateInput } from '@gauzy/contracts';
import { IntegrationMap } from 'core/entities/internal';
import { RequestContext } from 'core/context';
import { Tag } from './../../tag.entity';
import { TagService } from './../../tag.service';
import { AutomationLabelSyncCommand } from './../automation-label.sync.command';

@CommandHandler(AutomationLabelSyncCommand)
export class AutomationLabelSyncHandler implements ICommandHandler<AutomationLabelSyncCommand> {

	constructor(
		@InjectRepository(Tag) private readonly repository: Repository<Tag>,
		@InjectRepository(IntegrationMap) private readonly integrationMapRepository: Repository<IntegrationMap>,
		private readonly _tagService: TagService
	) { }

	async execute(command: AutomationLabelSyncCommand): Promise<ITag> {
		try {
			const { input } = command;
			const { sourceId, integrationId, organizationId, entity } = input;
			const tenantId = RequestContext.currentTenantId() || input.tenantId;

			try {
				// Check if an integration map already exists for the tag
				const integrationMap = await this.integrationMapRepository.findOneByOrFail({
					entity: command.entity,
					sourceId,
					integrationId,
					organizationId,
					tenantId
				});

				// Try to find the corresponding tag
				try {
					await this._tagService.findOneByIdString(integrationMap.gauzyId);

					// Update the corresponding tag with the new input data
					return await this.updateTag(integrationMap.gauzyId, {
						...entity,
						organizationId,
						tenantId
					});
				} catch (error) {
					// Create a new tag with the provided entity data
					return await this.createTag({
						organizationId,
						tenantId
					}, {
						...entity,
						id: integrationMap.gauzyId
					});
				}

			} catch (error) {
				// Create a tag tag with the provided entity data
				const tag = await this.createTag({ organizationId, tenantId }, entity);
				// Create a new integration map for the tag
				await this.integrationMapRepository.save(
					this.integrationMapRepository.create({
						gauzyId: tag.id,
						entity: command.entity,
						integrationId,
						sourceId,
						organizationId,
						tenantId
					})
				);
				return tag;
			}
		} catch (error) {
			console.log('Failed to sync in labels', error.message);
		}
	}


	/**
	 * Creates a new tag within a organization.
	 *
	 * @param options - An object containing parameters for tag creation.
	 * @returns A Promise that resolves to the newly created tag.
	 */
	async createTag(options: {
		organizationId: IOrganization['id'];
		tenantId: IOrganization['tenantId'];
	}, entity: ITagCreateInput | ITagUpdateInput): Promise<ITag> {
		try {
			// Create a new tag with the provided entity data
			const newTag = this.repository.create({
				...entity,
				organizationId: options.organizationId,
				tenantId: options.tenantId
			});

			// Save the new tag
			const createdTag = await this.repository.save(newTag);
			return createdTag;
		} catch (error) {
			// Handle and log errors, and return a rejected promise or throw an exception.
			console.error('Error automation syncing a tag:', error);
		}
	}

	/**
	 * Updates a tag with new data.
	 *
	 * @param id - The ID of the tag to update.
	 * @param entity - The new data for the tag.
	 * @returns A Promise that resolves to the updated tag.
	 */
	async updateTag(
		id: ITagUpdateInput['id'],
		entity: ITagUpdateInput
	): Promise<ITag> {
		try {
			// Find the existing tag by its ID
			const existingTag = await this._tagService.findOneByIdString(id);
			if (!existingTag) {
				return;
			}

			// Update the existing tag with the new entity data
			this.repository.merge(existingTag, entity);

			// Save the updated tag
			const updatedTag = await this.repository.save(existingTag);
			return updatedTag;
		} catch (error) {
			// Handle and log errors, and return a rejected promise or throw an exception.
			console.error('Error automation syncing a tag:', error);
		}
	}
}
