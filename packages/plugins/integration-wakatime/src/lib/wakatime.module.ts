import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmWakatimeRepository } from './repository/type-orm-wakatime.repository';
import { MikroOrmWakatimeRepository } from './repository/mikro-orm-wakatime.repository';
import { WakatimeService } from './wakatime.service';
import { WakatimeController } from './wakatime.controller';
import { Wakatime } from './wakatime.entity';

@Module({
	imports: [TypeOrmModule.forFeature([Wakatime]), MikroOrmModule.forFeature([Wakatime])],
	controllers: [WakatimeController],
	providers: [WakatimeService, TypeOrmWakatimeRepository, MikroOrmWakatimeRepository]
})
export class WakatimeModule {}
