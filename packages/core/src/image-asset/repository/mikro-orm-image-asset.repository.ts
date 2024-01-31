import { EntityRepository } from '@mikro-orm/core';
import { ImageAsset } from '../image-asset.entity';

export class MikroOrmImageAssetRepository extends EntityRepository<ImageAsset> { }