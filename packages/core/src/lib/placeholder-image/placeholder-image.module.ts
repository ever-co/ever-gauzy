import { Module } from '@nestjs/common';
import { PlaceholderImageController } from './placeholder-image.controller';

@Module({
	controllers: [PlaceholderImageController]
})
export class PlaceholderImageModule {}
