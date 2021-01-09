import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(private health: HealthCheckService, private db: TypeOrmHealthIndicator) {}

  @Get()
  check() {
    return this.health.check([async () => this.db.pingCheck('database', { timeout: 300 })]);
  }
}
