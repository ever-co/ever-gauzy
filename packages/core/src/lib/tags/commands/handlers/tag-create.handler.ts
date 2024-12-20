import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { HttpException, HttpStatus } from "@nestjs/common";
import { ITag, ITagCreateInput } from "@gauzy/contracts";
import { TagCreateCommand } from "./../tag-create.command";
import { TagService } from "./../../tag.service";

@CommandHandler(TagCreateCommand)
export class TagCreateHandler implements ICommandHandler<TagCreateCommand> {

	constructor(
		private readonly _tagService: TagService,
	) { }

	/**
	* Execute the creation of a new tag based on the provided input data.
	*
	* @param command - The command object containing the tag creation input.
	* @returns A promise that resolves to the newly created tag.
	* @throws An error if the tag creation fails.
	*/
	public async execute(command: TagCreateCommand): Promise<ITag> {
		const { input } = command;
		return await this.create(input);
	}

	/**
	 * Create a new tag based on the provided input data.
	 *
	 * @param request - The input data for creating a new tag.
	 * @returns A promise that resolves to the newly created tag.
	 * @throws An error if the tag creation fails.
	 */
	public async create(request: ITagCreateInput): Promise<ITag> {
		try {
			return await this._tagService.create(request);
		} catch (error) {
			console.log('Error while creating tag %s', error?.message);
			throw new HttpException({ message: error?.message, error }, HttpStatus.BAD_REQUEST);
		}
	}
}
