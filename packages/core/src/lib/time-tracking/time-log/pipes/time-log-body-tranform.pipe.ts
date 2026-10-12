import { IManualTimeInput, PermissionsEnum } from "@gauzy/contracts";
import { ArgumentMetadata, Injectable, PipeTransform } from "@nestjs/common";
import { RequestContext } from "./../../../core/context";

@Injectable()
export class TimeLogBodyTransformPipe implements PipeTransform<IManualTimeInput>  {
    transform(entity: IManualTimeInput, metadata: ArgumentMetadata) {
		// Only a missing employee is filled with the caller's own (the desktop timer updates a log with its
		// dates alone). A named employee is kept: the service refuses it unless the caller may act for them.
		if (!entity.employeeId && !RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			const user = RequestContext.currentUser();
            entity.employeeId = user.employeeId;
		}
        return entity;
    }
}