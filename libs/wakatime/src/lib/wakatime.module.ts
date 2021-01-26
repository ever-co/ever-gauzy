import { Module } from '@nestjs/common';
import { WakatimeService } from './wakatime.service';
import { WakatimeController } from './wakatime.controller';
import { Wakatime } from './wakatime.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
@Module({
	imports: [TypeOrmModule.forFeature([Wakatime])],
	controllers: [WakatimeController],
	providers: [WakatimeService],
	exports: [WakatimeService]
})
export class WakatimeModule {}
