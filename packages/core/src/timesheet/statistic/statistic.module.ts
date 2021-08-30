import { Module } from '@nestjs/common';
import { StatisticController } from './statistic.controller';
import { StatisticService } from './statistic.service';

@Module({
	controllers: [
		StatisticController
	],
	imports: [],
	providers: [
        StatisticService
    ],
	exports: [
        StatisticService
    ]
})
export class StatisticModule {}
