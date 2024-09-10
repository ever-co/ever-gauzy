import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { FavoriteTypeEnum } from '@gauzy/contracts';
import { FAVORITABLE_TYPE } from '../core/decorators/is-favoritable';

@Injectable()
export class GlobalFavoriteDiscoveryService implements OnModuleInit {
	private readonly serviceMap = new Map<FavoriteTypeEnum, any>();

	constructor(
		private readonly discoveryService: DiscoveryService,
		private readonly metadataScanner: MetadataScanner,
		private readonly reflector: Reflector
	) {}

	// Scan all app providers
	onModuleInit() {
		const providers = this.discoveryService.getProviders();
		this.scanProviders(providers);
		// providers.forEach((wrapper: InstanceWrapper) => {
		// 	const { instance, metatype } = wrapper;
		// 	if (!instance || !metatype) {
		// 		return;
		// 	}

		// 	// Add service to "Favoritable" services map if has specified favorite decorator
		// 	const isFavoriteService = this.reflector.get(FAVORITABLE_TYPE, metatype);
		// 	if (isFavoriteService) {
		// 		const type = this.extractTypeFromProvider(metatype);
		// 		if (type) {
		// 			this.serviceMap.set(type, instance);
		// 		}
		// 	}
		// });
	}

	private scanProviders(providers: InstanceWrapper[]) {
		providers.forEach((wrapper: InstanceWrapper) => {
			const { instance, metatype } = wrapper;
			if (!instance || !metatype) {
				return;
			}

			const isFavoriteService = this.reflector.get(FAVORITABLE_TYPE, metatype);
			if (isFavoriteService) {
				const type = this.extractTypeFromProvider(metatype);
				if (type) {
					// TODO : Change this and use getAllMethodNames method instead of scanFromPrototype
					const methods = this.metadataScanner.scanFromPrototype(
						instance,
						Object.getPrototypeOf(instance),
						(method) => method
					);
					this.serviceMap.set(type, { instance, methods });
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

	callMethod(type: FavoriteTypeEnum, methodName: string, ...args: any[]): any {
		const serviceWithMethods = this.serviceMap.get(type);
		if (!serviceWithMethods) {
			throw new Error(`Service for type ${type} not found`);
		}
		const { instance, methods } = serviceWithMethods;
		if (!methods.includes(methodName)) {
			throw new Error(`Method ${methodName} not found in service for type ${type}`);
		}
		return instance[methodName](...args);
	}
}
