import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { OrganizationPositions } from './organization-positions.entity';
import { OrganizationPositionsController } from './organization-positions.controller';
import { OrganizationPositionsService } from './organization-positions.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/organization-positions',
				module: OrganizationPositionsModule
			}
		]),
		TypeOrmModule.forFeature([OrganizationPositions]),
		TenantModule
	],
	controllers: [OrganizationPositionsController],
	providers: [OrganizationPositionsService],
	exports: [OrganizationPositionsService]
})
export class OrganizationPositionsModule {}
