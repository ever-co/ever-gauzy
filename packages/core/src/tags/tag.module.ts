import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { CqrsModule } from '@nestjs/cqrs';
import { TagService } from './tag.service';
import { TagController } from './tag.controller';
import { Tag } from './tag.entity';
import { UserModule } from '../user/user.module';
import { TenantModule } from '../tenant/tenant.module';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/tags', module: TagModule }
		]),
		TypeOrmModule.forFeature([ Tag ]),
		UserModule,
		TenantModule,
		CqrsModule
	],
	controllers: [TagController],
	providers: [TagService, ...CommandHandlers],
	exports: [TagService]
})
export class TagModule {}
