import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { GlobalFavoriteDiscoveryService } from './global-favorite-service.service';

@Module({
	imports: [DiscoveryModule],
	providers: [GlobalFavoriteDiscoveryService],
	exports: [GlobalFavoriteDiscoveryService]
})
export class GlobalFavoriteModule {}
