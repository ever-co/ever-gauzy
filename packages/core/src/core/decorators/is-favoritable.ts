import { SetMetadata } from '@nestjs/common';

export const FAVORITE_SERVICE = 'FAVORITE_SERVICE';
export const FavoriteService = () => SetMetadata(FAVORITE_SERVICE, true);
