import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Income } from './income.entity';
import { IncomeService } from './income.service';
import { IncomeController } from './income.controller';
import { CommandHandlers } from './commands/handlers';
import { CqrsModule } from '@nestjs/cqrs';

@Module({
    imports: [
        TypeOrmModule.forFeature([Income]),
        CqrsModule
    ],
    controllers: [IncomeController],
    providers: [IncomeService,  ...CommandHandlers],
    exports: [IncomeService],
})
export class IncomeModule { }
