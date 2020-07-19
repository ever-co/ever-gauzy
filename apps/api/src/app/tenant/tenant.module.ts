import { Module } from '@nestjs/common';
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
		RolePermissionsModule
	],
	controllers: [TenantController],
	providers: [TenantService],
	exports: [TenantService]
})
export class TenantModule {}
