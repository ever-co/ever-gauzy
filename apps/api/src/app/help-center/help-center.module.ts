import { HelpCenterController } from './help-center.controller';
import { HelpCenter } from './help-center.entity';
import { HelpCenterService } from './help-center.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { Module } from '@nestjs/common';
import { CommandHandlers } from './commands/handlers';
import { CqrsModule } from '@nestjs/cqrs';

@Module({
	imports: [TypeOrmModule.forFeature([HelpCenter, User]), CqrsModule],
	providers: [HelpCenterService, UserService, ...CommandHandlers],
	controllers: [HelpCenterController],
	exports: [HelpCenterService]
})
export class HelpCenterModule {}
