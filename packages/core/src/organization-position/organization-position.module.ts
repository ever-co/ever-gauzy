import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { OrganizationPosition } from './organization-position.entity';
import { OrganizationPositionController } from './organization-position.controller';
import { OrganizationPositionService } from './organization-position.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/organization-positions',
				module: OrganizationPositionModule
			}
		]),
		TypeOrmModule.forFeature([OrganizationPosition]),
		TenantModule
	],
	controllers: [OrganizationPositionController],
	providers: [OrganizationPositionService],
	exports: [OrganizationPositionService]
})
export class OrganizationPositionModule {}
