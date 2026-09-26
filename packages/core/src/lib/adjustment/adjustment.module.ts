import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Adjustment } from './adjustment.entity';
import { AdjustmentReason } from './adjustment-reason.entity';
import { AdjustmentService } from './adjustment.service';
import { TypeOrmAdjustmentRepository } from './repository/type-orm-adjustment.repository';
import { MikroOrmAdjustmentRepository } from './repository/mikro-orm-adjustment.repository';
import { TypeOrmAdjustmentReasonRepository } from './repository/type-orm-adjustment-reason.repository';
import { MikroOrmAdjustmentReasonRepository } from './repository/mikro-orm-adjustment-reason.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([Adjustment, AdjustmentReason]),
		MikroOrmModule.forFeature([Adjustment, AdjustmentReason])
	],
	providers: [
		AdjustmentService,
		TypeOrmAdjustmentRepository,
		MikroOrmAdjustmentRepository,
		TypeOrmAdjustmentReasonRepository,
		MikroOrmAdjustmentReasonRepository
	],
	exports: [
		AdjustmentService,
		TypeOrmAdjustmentRepository,
		MikroOrmAdjustmentRepository,
		TypeOrmAdjustmentReasonRepository,
		MikroOrmAdjustmentReasonRepository
	]
})
export class AdjustmentModule {}
