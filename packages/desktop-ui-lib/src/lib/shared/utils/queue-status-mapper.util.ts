import { StatusBadgeType, QueueStatus } from "../interfaces/queue.interface";
export class StatusMapper {
    private static readonly STATUS_MAP:  Record<string, StatusBadgeType> = {
        'active': StatusBadgeType.SUCCESS,
        'succeeded': StatusBadgeType.SUCCESS,
        'synced': StatusBadgeType.SUCCESS,
        'pending': StatusBadgeType.WARNING,
        'waiting': StatusBadgeType.WARNING,
        'inactive': StatusBadgeType. DANGER,
        'failed': StatusBadgeType.DANGER,
        'running': StatusBadgeType.INFO,
        'process':  StatusBadgeType.INFO,
    };

    static getBadgeStatus(status: string | null | undefined): StatusBadgeType {
        const normalizedStatus = String(status || '').toLowerCase();
        return this.STATUS_MAP[normalizedStatus] || StatusBadgeType. BASIC;
    }

    static getStatusForTab(tab: string): QueueStatus | null {
        const tabMap:  Record<string, QueueStatus> = {
            'PENDING': QueueStatus.WAITING,
            'FAILED': QueueStatus.FAILED,
            'SYNCED': QueueStatus.SUCCEEDED,
            'PROCESS': QueueStatus.RUNNING,
        };
        return tabMap[tab] || null;
    }
}
