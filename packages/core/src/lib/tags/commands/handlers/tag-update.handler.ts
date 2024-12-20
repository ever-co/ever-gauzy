import { HttpException, HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITag, ITagUpdateInput } from '@gauzy/contracts';
import { TagUpdateCommand } from './../tag-update.command';
import { TagService } from './../../tag.service';

@CommandHandler(TagUpdateCommand)
export class TagUpdateHandler implements ICommandHandler<TagUpdateCommand> {

	constructor(
		private readonly _tagService: TagService
	) { }

	/**
	 * Execute the update of an existing tag based on the provided ID and input data.
	 *
	 * @param command - The command object containing the tag ID and update input.
	 * @returns A promise that resolves to the updated tag.
	 * @throws An error if the tag update fails.
	 */
	public async execute(command: TagUpdateCommand): Promise<ITag> {
		const { id, input } = command;
		return await this.update(id, input);
	}

	/**
	 * Update an existing tag with the specified ID and provided update data.
	 *
	 * @param id - The ID of the tag to update.
	 * @param request - The update data for the tag.
	 * @returns A promise that resolves to the updated tag.
	 * @throws An error if the tag update fails.
	 */
	public async update(id: string, request: ITagUpdateInput): Promise<ITag> {
		try {
			await this._tagService.findOneByIdString(id);

			return await this._tagService.create({
				...request,
				id
			});
		} catch (error) {
			console.log('Error while updating tag %s', error?.message);
			throw new HttpException({ message: error?.message, error }, HttpStatus.BAD_REQUEST);
		}
	}
}
