import { NestModule, MiddlewareConsumer, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantSetting } from '../../tenant/tenant-setting/tenant-setting.entity';

@Module({
	imports: [TypeOrmModule.forFeature([TenantSetting])],
	controllers: [],
	providers: []
})
export class FileStorageModule implements NestModule {
	configure(consumer: MiddlewareConsumer) {
		// consumer.apply(RequestContextMiddleware).forRoutes('*');
	}
}
