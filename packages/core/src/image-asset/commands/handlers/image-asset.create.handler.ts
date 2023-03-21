import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IImageAsset } from '@gauzy/contracts';
import { ImageAssetCreateCommand } from '../image-asset.create.command';
import { ImageAssetService } from '../../image-asset.service';

@CommandHandler(ImageAssetCreateCommand)
export class ImageAssetCreateHandler implements ICommandHandler<ImageAssetCreateCommand> {

	constructor(
		private readonly _imageAssetService: ImageAssetService
	) { }

	public async execute(
		command: ImageAssetCreateCommand
	): Promise<IImageAsset> {
		const { input } = command;
		return await this._imageAssetService.create(input);
	}
}
