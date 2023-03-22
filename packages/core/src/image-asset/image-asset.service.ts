import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { IImageAsset } from '@gauzy/contracts';
import { RequestContext } from './../core/context';
import { TenantAwareCrudService } from './../core/crud';
import { ImageAsset } from './image-asset.entity';

@Injectable()
export class ImageAssetService extends TenantAwareCrudService<ImageAsset> {
	constructor(
		@InjectRepository(ImageAsset)
		private readonly imageAssetRepository: Repository<ImageAsset>
	) {
		super(imageAssetRepository);
	}

	/**
	 * Create image asset
	 *
	 * @param entity
	 * @returns
	 */
	public async create(entity: DeepPartial<ImageAsset>): Promise<IImageAsset> {
		const user = RequestContext.currentUser();
		try {
			return await super.create(entity);
		} catch (error) {
			console.log(`Error while creating image assets for user (${user.name})`, error);
			throw new BadRequestException(error);
		}
	}

	async deleteAsset(imageId: string): Promise<ImageAsset> {
		let result = await this.imageAssetRepository.findOne({
			where: { id: imageId },
			relations: ['productGallery', 'productFeaturedImage']
		});

		if (result && (result.productGallery.length || result.productFeaturedImage.length)) {
			throw new HttpException('Image is under use', HttpStatus.BAD_REQUEST);
		}

		return this.imageAssetRepository.remove(result);
	}
}
