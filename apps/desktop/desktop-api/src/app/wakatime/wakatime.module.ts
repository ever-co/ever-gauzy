import { Module } from '@nestjs/common';
import { WakatimeService } from './wakatime.service';
import { WakatimeController } from './wakatime.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wakatime } from './wakatime.entity';

@Module({
	imports: [TypeOrmModule.forFeature([Wakatime])],
	controllers: [WakatimeController],
	providers: [WakatimeService]
})
export class WakatimeModule {}
