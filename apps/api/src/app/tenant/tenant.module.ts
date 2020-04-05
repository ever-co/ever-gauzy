import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth';
import { RoleModule } from '../role';
import { UserModule } from '../user';
import { TenantController } from './tenant.controller';
import { Tenant } from './tenant.entity';
import { TenantService } from './tenant.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([Tenant]),
		AuthModule,
		UserModule,
		RoleModule
	],
	controllers: [TenantController],
	providers: [TenantService],
	exports: [TenantService]
})
export class TenantModule {}
