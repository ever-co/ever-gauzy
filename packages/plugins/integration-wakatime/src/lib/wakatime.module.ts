import { Module } from '@nestjs/common';
import { WakatimeService } from './wakatime.service';
import { WakatimeController } from './wakatime.controller';
import { Wakatime } from './wakatime.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		TypeOrmModule.forFeature([Wakatime]),
		MikroOrmModule.forFeature([Wakatime]),
	],
	controllers: [WakatimeController],
	providers: [WakatimeService],
	exports: [WakatimeService],
})
export class WakatimeModule { }
