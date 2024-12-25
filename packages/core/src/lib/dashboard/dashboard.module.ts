import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { Dashboard } from './dashboard.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
	imports: [
		TypeOrmModule.forFeature([Dashboard]),
		MikroOrmModule.forFeature([Dashboard]),
	],
	controllers: [DashboardController],
	providers: [DashboardService],
	exports: []
})
export class DashboardModule {}
