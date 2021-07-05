import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommandHandlers } from './commands/handlers' 
import { ImportRecord } from './import-record.entity';
import { ImportRecordService } from './import-record.service';

@Module({
	imports: [
		CqrsModule,
		forwardRef(() => TypeOrmModule.forFeature([ ImportRecord ])),
	],
	providers: [ ImportRecordService, ...CommandHandlers ],
	exports: [ ImportRecordService ]
})
export class ImportRecordModule {}