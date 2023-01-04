import { DAO, IClientFilterOption } from '../../interfaces';
import { ClientTO } from '../dto';

export class ClientDAO implements DAO<ClientTO> {
	findAll(): Promise<ClientTO[]> {
		throw new Error('Method not implemented.');
	}
	save(value: ClientTO): Promise<void> {
		throw new Error('Method not implemented.');
	}
	findOneById(id: number): Promise<ClientTO> {
		throw new Error('Method not implemented.');
	}
	update(id: number, value: Partial<ClientTO>): Promise<void> {
		throw new Error('Method not implemented.');
	}
	delete(value: Partial<ClientTO>): Promise<void> {
		throw new Error('Method not implemented.');
	}

	findOneByOptions(options: IClientFilterOption): Promise<ClientTO> {
		throw new Error('Method not implemented.');
	}
}
