import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { FavoriteTypeEnum } from '@gauzy/contracts';
import { FAVORITABLE_TYPE } from '../core/decorators/is-favoritable';

@Injectable()
export class GlobalFavoriteDiscoveryService implements OnModuleInit {
	private readonly serviceMap = new Map<FavoriteTypeEnum, any>();

	constructor(private readonly discoveryService: DiscoveryService, private readonly reflector: Reflector) {}

	// Scan all app providers
	onModuleInit() {
		const providers = this.discoveryService.getProviders();

		providers.forEach((wrapper: InstanceWrapper) => {
			const { instance, metatype } = wrapper;
			if (!instance || !metatype) {
				return;
			}

			// Add service to "Favoritable" services map if has specified favorite decorator
			const isFavoriteService = this.reflector.get(FAVORITABLE_TYPE, metatype);
			if (isFavoriteService) {
				const type = this.extractTypeFromProvider(metatype);
				if (type) {
					this.serviceMap.set(type, instance);
				}
			}
		});
	}

	// Extract service favorite type
	private extractTypeFromProvider(metatype: any): FavoriteTypeEnum | null {
		return Reflect.getMetadata(FAVORITABLE_TYPE, metatype);
	}

	// Get "Favoritable" service
	getService(type: FavoriteTypeEnum) {
		return this.serviceMap.get(type);
	}
}
