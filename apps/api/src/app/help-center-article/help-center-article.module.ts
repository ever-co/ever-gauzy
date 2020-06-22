import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { Module } from '@nestjs/common';
import { HelpCenterArticle } from './help-center-article.entity';
import { HelpCenterArticleService } from './help-center-article.service';
import { HelpCenterArticleController } from './help-center-article.controller';

@Module({
	imports: [TypeOrmModule.forFeature([HelpCenterArticle, User])],
	providers: [HelpCenterArticleService, UserService],
	controllers: [HelpCenterArticleController],
	exports: [HelpCenterArticleService]
})
export class HelpCenterArticleModule {}
