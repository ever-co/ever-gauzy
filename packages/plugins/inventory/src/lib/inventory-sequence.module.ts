/**
 * NestJS module of the inventory numbering series.
 *
 * It registers the platform’s sequence entity so the allocator can take a row lock on a series, and it
 * is imported by every aggregate that numbers a document.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Sequence } from '@gauzy/core';
import { InventorySequenceService } from './inventory-sequence.service';

@Module({
	imports: [TypeOrmModule.forFeature([Sequence]), MikroOrmModule.forFeature([Sequence])],
	providers: [InventorySequenceService],
	exports: [InventorySequenceService]
})
export class InventorySequenceModule {}
