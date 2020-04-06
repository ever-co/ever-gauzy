import { Module, HttpModule } from '@nestjs/common';
import { HubstaffService } from './hubstaff.service';
import { HubstaffController } from './hubstaff.controller';

@Module({
	imports: [HttpModule],
	controllers: [HubstaffController],
	providers: [HubstaffService]
})
export class HubstaffModule {}
