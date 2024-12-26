import { Module } from '@nestjs/common';
import { DashboardWidgetService } from './dashboard-widget.service';
import { DashboardWidgetController } from './dashboard-widget.controller';

@Module({
  providers: [DashboardWidgetService],
  controllers: [DashboardWidgetController]
})
export class DashboardWidgetModule {}
