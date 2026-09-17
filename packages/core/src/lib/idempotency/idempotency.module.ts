import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { IdempotencyKey } from './idempotency-key.entity';
import { IdempotencyService } from './idempotency.service';
import { TypeOrmIdempotencyKeyRepository } from './repository/type-orm-idempotency-key.repository';
import { MikroOrmIdempotencyKeyRepository } from './repository/mikro-orm-idempotency-key.repository';

@Module({
	imports: [TypeOrmModule.forFeature([IdempotencyKey]), MikroOrmModule.forFeature([IdempotencyKey])],
	providers: [IdempotencyService, TypeOrmIdempotencyKeyRepository, MikroOrmIdempotencyKeyRepository],
	exports: [IdempotencyService, TypeOrmIdempotencyKeyRepository, MikroOrmIdempotencyKeyRepository]
})
export class IdempotencyModule {}
