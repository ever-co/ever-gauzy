import { Injectable } from '@nestjs/common';
import { CrudService } from '../core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductAsset } from './product-asset.entity';

@Injectable()
export class ProductAssetService extends CrudService<ProductAsset> {
	constructor(
		@InjectRepository(ProductAsset)
		private readonly productAssetRepository: Repository<ProductAsset>
	) {
		super(productAssetRepository);
	}
}
