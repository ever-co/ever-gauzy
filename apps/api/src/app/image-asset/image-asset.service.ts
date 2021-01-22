import { Injectable } from '@nestjs/common';
import { CrudService } from '../core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImageAsset } from './image-asset.entity';

@Injectable()
export class ImageAssetService extends CrudService<ImageAsset> {
	constructor(
		@InjectRepository(ImageAsset)
		private readonly productAssetRepository: Repository<ImageAsset>
	) {
		super(productAssetRepository);
	}
}
