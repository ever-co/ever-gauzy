import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RolePermissionsModule } from '../role-permissions/role-permissions.module';
import { RoleModule } from '../role/role.module';
import { UserModule } from '../user/user.module';
import { TenantController } from './tenant.controller';
import { Tenant } from './tenant.entity';
import { TenantService } from './tenant.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([Tenant]),
		AuthModule,
		UserModule,
		RoleModule,
		RolePermissionsModule,
		CqrsModule
	],
	controllers: [TenantController],
	providers: [TenantService],
	exports: [TenantService, RolePermissionsModule]
})
export class TenantModule {}
