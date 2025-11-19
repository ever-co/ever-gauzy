import { AppError } from '../../error-handler';
import { IKbMouseActivityService } from '../../interfaces';
import { KbMouseActivityDAO } from '../dao';
import { KbMouseActivityTO } from '../dto';
import { KbMouseActivity } from '../models';

export class KbMouseActivityService implements IKbMouseActivityService<KbMouseActivityTO> {
	private _kbMouseDAO: KbMouseActivityDAO;

	constructor() {
		this._kbMouseDAO = new KbMouseActivityDAO();
	}

	public async save(activities: KbMouseActivityTO): Promise<void> {
		try {
			if (!activities) {
				return console.error('WARN[KB_MOUSE_SERVICE]: No keyboard and mouse data, cannot save');
			}
			await this._kbMouseDAO.save(activities);
		} catch (error) {
			throw new AppError('KB_MOUSE_SERVICE', error);
		}
	}

	public async saveAndReturn(activities: KbMouseActivityTO): Promise<KbMouseActivityTO | null> {
		try {
			if (!activities) {
				console.error('WARN[KB_MOUSE_SERVICE]: No keyboard and mouse data, cannot save');
				return null;
			}
			const created = await this._kbMouseDAO.saveAndReturn(activities);
			return created;
		} catch (error) {
			throw new AppError('KB_MOUSE_SERVICE', error);
		}
	}

	public async update(activities: Partial<KbMouseActivityTO>): Promise<void> {
		try {
			if (!activities.id) {
				return console.error('WARN[KB_MOUSE_SERVICE]: No keyboard and mouse data, cannot update');
			}
			await this._kbMouseDAO.update(activities.id, activities);
		} catch (error) {
			throw new AppError('KB_MOUSE_SERVICE', error);
		}
	}

	public async retrieve(remoteId: string, organizationId: string, tenantId: string): Promise<KbMouseActivityTO> {
		try {
			const activitiesDao = await this._kbMouseDAO.current(remoteId, organizationId, tenantId);
			if (activitiesDao) {
				const activities = new KbMouseActivity(activitiesDao);
				return activities;
			}
			return null;
		} catch (error) {
			console.error(error);
			return null;
		}
	}

	public async findById(activity: Partial<KbMouseActivityTO>): Promise<KbMouseActivityTO> {
		try {
			if (!activity.id) {
				console.error('WARN[KB_MOUSE_SERVICE]: No activity data, cannot find');
				return null;
			}
			return await this._kbMouseDAO.findOneById(activity.id);
		} catch (error) {
			console.error(error);
			return null;
		}
	}

	public async remove(activity: Partial<KbMouseActivityTO>): Promise<void> {
		try {
			await this._kbMouseDAO.delete(activity);
		} catch (error) {
			throw new AppError('KB_MOUSE_SERVICE', error);
		}
	}

	public async findUnsyncActivity(
		remoteId: string,
		organizationId: string,
		tenantId: string,
	): Promise<KbMouseActivityTO[]> {
		try {
			return await this._kbMouseDAO.findUnsyncActivity(remoteId, organizationId, tenantId)
		} catch (error) {
			console.error(error);
			return [];
		}
	}
}
