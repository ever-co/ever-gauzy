import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Wakatime } from './wakatime.entity';
@Injectable()
export class WakatimeService {
	constructor(
		@InjectRepository(Wakatime)
		private wakatimeRepository: Repository<Wakatime>
	) {}
	getData(): any {
		return this.wakatimeRepository.find();
	}
}
