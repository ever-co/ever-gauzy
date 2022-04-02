import { AvatarComponent } from "../../components/avatar/avatar.component";
import { Component } from "@angular/core";

@Component({
	selector: 'ga-report-table-user-avatar',
	templateUrl: '../../components/avatar/avatar.component.html',
	styleUrls: ['./report-table-user-avatar.component.scss']
})
export class ReportTableUserAvatarComponent extends AvatarComponent {}