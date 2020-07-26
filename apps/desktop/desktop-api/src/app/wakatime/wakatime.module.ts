import { Module } from '@nestjs/common';
import { WakatimeService } from './wakatime.service';
import { WakatimeController } from './wakatime.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wakatime } from './wakatime.entity';
import { Projects } from './projects.entity';
import { Branches } from './branches.entity';
import { Languages } from './language.entity';
import { Machine } from './machine.entity';
import { Os } from './os.entity';

@Module({
	imports: [TypeOrmModule.forFeature([Wakatime])],
	controllers: [WakatimeController],
	providers: [WakatimeService]
})
export class WakatimeModule {}
