import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { Module } from '@nestjs/common';
import { HelpCenterAuthorService } from './help-center-author.service';
import { HelpCenterAuthorController } from './help-center-author.controller';
import { HelpCenterAuthor } from './help-center-author.entity';

@Module({
	imports: [TypeOrmModule.forFeature([HelpCenterAuthor, User])],
	providers: [HelpCenterAuthorService, UserService],
	controllers: [HelpCenterAuthorController],
	exports: [HelpCenterAuthorService]
})
export class HelpCenterAuthorModule {}
