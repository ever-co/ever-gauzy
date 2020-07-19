import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KeyResultUpdateService } from './keyresult-update.service';
import { KeyResultUpdateController } from './keyresult-update.controller';
import { KeyResultUpdate } from './keyresult-update.entity';

@Module({
	imports: [TypeOrmModule.forFeature([KeyResultUpdate])],
	controllers: [KeyResultUpdateController],
	providers: [KeyResultUpdateService],
	exports: [KeyResultUpdateService]
})
export class KeyResultUpdateModule {}
