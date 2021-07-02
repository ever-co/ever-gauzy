import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommandHandlers } from './commands/handlers' 
import { ImportHistory } from './import-history.entity';
import { ImportHistoryService } from './import-history.service';

@Module({
	imports: [
		CqrsModule,
		forwardRef(() => TypeOrmModule.forFeature([ ImportHistory ])),
	],
	providers: [ ImportHistoryService, ...CommandHandlers ],
	exports: [ ImportHistoryService ]
})
export class ImportHistoryModule {}