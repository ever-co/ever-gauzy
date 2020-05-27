import { HelpCenterController } from './help-center.controller';
import { HelpCenter } from './help-center.entity';
import { HelpCenterService } from './help-center.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { Module } from '@nestjs/common';

@Module({
	imports: [TypeOrmModule.forFeature([HelpCenter, User])],
	providers: [HelpCenterService, UserService],
	controllers: [HelpCenterController],
	exports: [HelpCenterService],
})
export class HelpCenterModule {}
