import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { Dashboard } from './dashboard.entity';

@Module({
	imports: [
		TypeOrmModule.forFeature([Dashboard]),
		MikroOrmModule.forFeature([Dashboard]),
	],
	controllers: [],
	providers: [],
	exports: []
})
export class DashboardModule {}
