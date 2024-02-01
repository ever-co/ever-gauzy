import { NestModule, MiddlewareConsumer, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantSetting } from '../../tenant/tenant-setting/tenant-setting.entity';
import { TenantSettingService } from '../../tenant/tenant-setting/tenant-setting.service';
import { FileStorageMiddleware } from './file-storage.middleware';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		TypeOrmModule.forFeature([TenantSetting]),
		MikroOrmModule.forFeature([TenantSetting]),
	],
	controllers: [],
	providers: [FileStorageMiddleware, TenantSettingService]
})
export class FileStorageModule implements NestModule {
	configure(consumer: MiddlewareConsumer) {
		consumer.apply(FileStorageMiddleware).forRoutes('*');
	}
}
