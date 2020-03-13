import { Module, HttpModule } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ExportAllController } from './export-all.controller';
import { ExportAllService } from './export-all.service';

@Module({
	imports: [CqrsModule, HttpModule],
	controllers: [ExportAllController],
	providers: [ExportAllService],
	exports: [ExportAllService]
})
export class ExportAllModule {}
