import { Component } from '@angular/core';
import { InvitationTypeEnum } from '@gauzy/contracts';

@Component({
    selector: 'ga-manage-employee-invite',
    templateUrl: './manage-employee-invite.component.html',
    standalone: false
})
export class ManageEmployeeInviteComponent {

	invitationTypeEnum = InvitationTypeEnum;

	constructor() {}
}
