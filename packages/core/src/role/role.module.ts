import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { Role } from './role.entity';
import { RoleService } from './role.service';
import { RoleController } from './role.controller';
import { TenantModule } from '../tenant/tenant.module';
import { CommandHandlers } from './commands/handlers';
import { UserModule } from './../user';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/role', module: RoleModule }
		]),
		forwardRef(() => TypeOrmModule.forFeature([ Role ])),
		forwardRef(() => TenantModule),
		forwardRef(() => UserModule),
		CqrsModule
	],
	controllers: [RoleController],
	providers: [RoleService, ...CommandHandlers],
	exports: [TypeOrmModule, RoleService]
})
export class RoleModule {}
