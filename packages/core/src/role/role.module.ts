import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { Role } from './role.entity';
import { RoleService } from './role.service';
import { RoleController } from './role.controller';
import { TenantModule } from '../tenant/tenant.module';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.forRoutes([{ path: '/role', module: RoleModule }]),
		forwardRef(() => TypeOrmModule.forFeature([Role])),
		forwardRef(() => TenantModule),
		CqrsModule
	],
	controllers: [RoleController],
	providers: [RoleService, ...CommandHandlers],
	exports: [RoleService]
})
export class RoleModule {}
