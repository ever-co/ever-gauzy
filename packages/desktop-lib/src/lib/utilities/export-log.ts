import * as fs from 'node:fs';
import { AuditLogService } from '../offline/services';
import { dialog, SaveDialogReturnValue } from 'electron';

let auditLogService: AuditLogService | null = null;

function getAuditLogService(): AuditLogService {
	if (auditLogService) {
		return auditLogService;
	}
	auditLogService = new AuditLogService();
	return auditLogService;
}

async function showSaveDialog(): Promise<SaveDialogReturnValue> {
	return await dialog.showSaveDialog({
		title: 'Export Logs',
		defaultPath: `logs-${Date.now()}.jsonl`,
		filters: [
			{
				name: 'JSON Lines',
				extensions: ['jsonl']
			}
		]
	});
}

function closeStream(stream: fs.WriteStream): Promise<void> {
	return new Promise((resolve, reject) => {
		stream.end((err: Error | null | undefined) => (err ? reject(err) : resolve()));
	});
}

export async function exportAuditLogs(): Promise<{ success: boolean; filePath?: string }> {
	const { filePath, canceled } = await showSaveDialog();
	if (canceled || !filePath) {
		return { success: false };
	}

	const stream = fs.createWriteStream(filePath);

	let streamReject: (err: Error) => void;
	const streamError = new Promise<never>((_, reject) => {
		streamReject = reject;
		stream.once('error', reject);
	});

	try {
		const pageSize = 1000;
		let page = 0;
		while (true) {
			const logs = await getAuditLogService().findAuditLogs({
				page,
				limit: pageSize,
				sortBy: 'createdAt'
			});
			if (!logs?.data?.length) {
				break;
			}
			for (const row of logs.data) {
				if (!stream.write(JSON.stringify(row) + '\n')) {
					await Promise.race([new Promise<void>((resolve) => stream.once('drain', resolve)), streamError]);
				}
			}
			page += 1;
		}
		await Promise.race([closeStream(stream), streamError]);
		stream.off('error', streamReject!);
		return { success: true, filePath };
	} catch (err) {
		stream.off('error', streamReject!);
		stream.destroy();
		throw err;
	}
}
