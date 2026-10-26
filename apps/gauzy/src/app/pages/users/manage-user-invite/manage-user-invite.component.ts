import { Component, ChangeDetectionStrategy } from '@angular/core';
import { InvitationTypeEnum } from '@gauzy/contracts';

@Component({
    selector: 'ga-manage-user-invite',
    templateUrl: './manage-user-invite.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ManageUserInviteComponent {

	invitationTypeEnum = InvitationTypeEnum;

	constructor() {}
}
