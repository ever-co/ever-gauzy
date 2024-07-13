import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmWakatimeRepository } from './repository';
import { WakatimeService } from './wakatime.service';
import { WakatimeController } from './wakatime.controller';
import { Wakatime } from './wakatime.entity';

@Module({
	controllers: [WakatimeController],
	imports: [
		RouterModule.register([
			{
				path: '/v1/users/current',
				module: WakatimeModule
			}
		]),
		TypeOrmModule.forFeature([Wakatime]),
		MikroOrmModule.forFeature([Wakatime])
	],
	providers: [WakatimeService, TypeOrmWakatimeRepository],
	exports: [WakatimeService, TypeOrmWakatimeRepository]
})
export class WakatimeModule {}
