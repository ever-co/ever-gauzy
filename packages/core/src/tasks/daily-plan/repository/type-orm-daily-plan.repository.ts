import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DailyPlan } from '../daily-plan.entity';

@Injectable()
export class TypeOrmDailyPlanRepository extends Repository<DailyPlan> {}
