import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImageAsset } from './image-asset.entity';

@Injectable()
export class ImageAssetService extends TenantAwareCrudService<ImageAsset> {
	constructor(
		@InjectRepository(ImageAsset)
		private readonly imageAssetRepository: Repository<ImageAsset>
	) {
		super(imageAssetRepository);
	}

	async deleteAsset(imageId: string): Promise<ImageAsset> {
		let result = await this.imageAssetRepository.findOne({
			where: { id: imageId },
			relations: ['productGallery', 'productFeaturedImage']
		});

		if (
			result &&
			(result.productGallery.length || result.productFeaturedImage.length)
		) {
			throw new HttpException(
				'Image is under use',
				HttpStatus.BAD_REQUEST
			);
		}

		return this.imageAssetRepository.remove(result);
	}
}
