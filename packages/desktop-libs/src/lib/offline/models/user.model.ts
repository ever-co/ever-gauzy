import { IEmployee } from '@gauzy/contracts';
import { UserTO } from '../dto/user.dto';
import { Base } from './base.model';
import { Serializable } from 'lib/interfaces';

export class User extends Base implements UserTO, Serializable<UserTO> {
	private _email: string;
	private _employee: Partial<IEmployee>;
	private _employeeId: string;
	private _name: string;

	constructor(user: UserTO) {
		super(user.id, user.organizationId, user.remoteId, user.tenantId);
		this._email = user.email;
		this._employee = user.employee;
		this._employeeId = user.employeeId;
		this._name = user.name;
	}

	public get email(): string {
		return this._email;
	}
	public set email(value: string) {
		this._email = value;
	}
	public get employee(): Partial<IEmployee> {
		return this._employee;
	}
	public set employee(value: Partial<IEmployee>) {
		this._employee = value;
	}
	public get employeeId(): string {
		return this._employeeId;
	}
	public set employeeId(value: string) {
		this._employeeId = value;
	}
	public get name(): string {
		return this._name;
	}
	public set name(value: string) {
		this._name = value;
	}
	public toObject(): UserTO {
		return {
			...super.toObject(),
			name: this._name,
			email: this._email,
			employee: this._employee,
			employeeId: this._employeeId
		};
	}
}
