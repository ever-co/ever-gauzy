import { BadRequestException, Injectable, InternalServerErrorException, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { BaseEntityEnum } from '@gauzy/contracts';
import { FAVORITABLE_TYPE } from '../core/decorators/is-favoritable';

@Injectable()
export class GlobalFavoriteDiscoveryService implements OnModuleInit {
	private readonly serviceMap = new Map<BaseEntityEnum, any>();

	constructor(
		private readonly discoveryService: DiscoveryService,
		private readonly metadataScanner: MetadataScanner,
		private readonly reflector: Reflector
	) {}

	// Scan all app providers
	onModuleInit() {
		const providers = this.discoveryService.getProviders();
		this.scanProviders(providers);
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
					const methods = this.metadataScanner.getAllMethodNames(Object.getPrototypeOf(instance));
					this.serviceMap.set(type, { instance, methods });
				}
			}
		});
	}

	// Extract service favorite type
	private extractTypeFromProvider(metatype: any): BaseEntityEnum | null {
		return Reflect.getMetadata(FAVORITABLE_TYPE, metatype);
	}

	// Get "Favoritable" service
	getService(type: BaseEntityEnum) {
		return this.serviceMap.get(type);
	}

	callMethod(type: BaseEntityEnum, methodName: string, ...args: any[]): any {
		const serviceWithMethods = this.serviceMap.get(type);
		if (!serviceWithMethods) {
			throw new BadRequestException(`Service for type ${type} not found`);
		}
		const { instance, methods } = serviceWithMethods;
		if (!methods.includes(methodName)) {
			throw new InternalServerErrorException(`Method ${methodName} not found in service for type ${type}`);
		}
		return instance[methodName](...args);
	}
}
