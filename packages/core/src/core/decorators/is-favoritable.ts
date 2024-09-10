import { FavoriteTypeEnum } from '@gauzy/contracts';
import { SetMetadata } from '@nestjs/common';

export const FAVORITE_SERVICE = 'FAVORITE_SERVICE';
export const FAVORITABLE_TYPE = 'favoritableType';

export const FavoriteService = (type: FavoriteTypeEnum) => SetMetadata(FAVORITABLE_TYPE, type);
