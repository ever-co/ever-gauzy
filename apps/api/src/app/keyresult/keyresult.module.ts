import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KeyResult } from './keyresult.entity';
import { KeyResultService } from './keyresult.service';
import { KeyResultController } from './keyresult.controller';

@Module({
	imports: [TypeOrmModule.forFeature([KeyResult])],
	controllers: [KeyResultController],
	providers: [KeyResultService],
	exports: [KeyResultService]
})
export class KeyResultModule {}
