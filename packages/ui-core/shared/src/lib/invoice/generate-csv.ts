import { saveAs } from 'file-saver';

export async function generateCsv(data: any, headers: any, fileName: string) {
	const replacer = (key, value) => (value === null ? 'N/A' : value);
	const header = Object.keys(data[0]);
	const csv = data.map((row) =>
		header
			.map((fieldName) => JSON.stringify(row[fieldName], replacer))
			.join(',')
	);
	csv.unshift(headers);
	var BOM = '\uFEFF';
	const csvArray = BOM + csv.join('\r\n');
	var blob = new Blob([csvArray], { type: 'text/csv;charset=utf-8' });
	saveAs(blob, `${fileName}.csv`);
}
