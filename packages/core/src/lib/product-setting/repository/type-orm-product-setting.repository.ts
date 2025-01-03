import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductVariantSetting } from '../product-setting.entity';

@Injectable()
export class TypeOrmProductVariantSettingRepository extends Repository<ProductVariantSetting> {
    constructor(@InjectRepository(ProductVariantSetting) readonly repository: Repository<ProductVariantSetting>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
