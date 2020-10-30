import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './role.entity';
import { RoleService } from './role.service';
import { RoleController } from './role.controller';
import { TenantModule } from '../tenant/tenant.module';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		forwardRef(() => TypeOrmModule.forFeature([Role])),
		forwardRef(() => TenantModule)
	],
	controllers: [RoleController],
	providers: [RoleService, ...CommandHandlers],
	exports: [RoleService]
})
export class RoleModule {}
