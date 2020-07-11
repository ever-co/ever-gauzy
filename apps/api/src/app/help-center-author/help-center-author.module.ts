import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { Module } from '@nestjs/common';
import { HelpCenterAuthorService } from './help-center-author.service';
import { HelpCenterAuthorController } from './help-center-author.controller';
import { HelpCenterAuthor } from './help-center-author.entity';
import { CqrsModule } from '@nestjs/cqrs';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [TypeOrmModule.forFeature([HelpCenterAuthor, User]), CqrsModule],
	providers: [HelpCenterAuthorService, UserService, ...CommandHandlers],
	controllers: [HelpCenterAuthorController],
	exports: [HelpCenterAuthorService]
})
export class HelpCenterAuthorModule {}
