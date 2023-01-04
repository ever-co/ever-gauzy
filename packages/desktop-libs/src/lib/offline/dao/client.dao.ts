import { DAO, IClientFilterOption } from '../../interfaces';
import { clientTO } from '../dto';

export class ClientDAO implements DAO<clientTO> {
	findAll(): Promise<clientTO[]> {
		throw new Error('Method not implemented.');
	}
	save(value: clientTO): Promise<void> {
		throw new Error('Method not implemented.');
	}
	findOneById(id: number): Promise<clientTO> {
		throw new Error('Method not implemented.');
	}
	update(id: number, value: Partial<clientTO>): Promise<void> {
		throw new Error('Method not implemented.');
	}
	delete(value: Partial<clientTO>): Promise<void> {
		throw new Error('Method not implemented.');
	}

	findOneByOptions(options: IClientFilterOption): Promise<clientTO> {
		throw new Error('Method not implemented.');
	}
}
