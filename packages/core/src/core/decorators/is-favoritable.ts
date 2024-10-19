import { BaseEntityEnum } from '@gauzy/contracts';
import { SetMetadata } from '@nestjs/common';

export const FAVORITE_SERVICE = 'FAVORITE_SERVICE';
export const FAVORITABLE_TYPE = 'favoriteEntity';

export const FavoriteService = (type: BaseEntityEnum) => SetMetadata(FAVORITABLE_TYPE, type);
