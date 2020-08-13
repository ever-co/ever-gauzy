import { Module } from '@nestjs/common';
import { KeyresultTemplateController } from './keyresult-template.controller';
import { KeyresultTemplateService } from './keyresult-template.service';
import { KeyResultTemplate } from './keyresult-template.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
	imports: [TypeOrmModule.forFeature([KeyResultTemplate])],
	controllers: [KeyresultTemplateController],
	providers: [KeyresultTemplateService],
	exports: [KeyresultTemplateService]
})
export class KeyresultTemplateModule {}
