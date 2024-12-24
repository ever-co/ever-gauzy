export interface EmployeeTO {
    id? : string;
	endWork?: Date;
	startedWorkOn?: Date;
	isActive: boolean;
	totalWorkHours?: number;
	isVerified?: boolean;
	fullName?: string;
	isTrackingEnabled: boolean;
	isDeleted?: boolean;
}
