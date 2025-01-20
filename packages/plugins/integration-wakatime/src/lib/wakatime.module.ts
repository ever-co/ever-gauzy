import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmWakatimeRepository } from './repository';
import { WakatimeService } from './wakatime.service';
import { WakatimeController } from './wakatime.controller';
import { Wakatime } from './wakatime.entity';

@Module({
	imports: [TypeOrmModule.forFeature([Wakatime]), MikroOrmModule.forFeature([Wakatime])],
	controllers: [WakatimeController],
	providers: [WakatimeService, TypeOrmWakatimeRepository]
})
export class WakatimeModule {}
