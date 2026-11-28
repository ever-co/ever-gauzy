/**
 * The payment's printed receipt: a document of its own, written into a hidden frame and printed from there, as the
 * documents' print is. Printing the page itself would print the app around it — its header, its menu, its scrolling
 * layout — and every panel; the receipt holds only the payment and the invoice it pays.
 */

/** One "label: value" line of the receipt. Lines without a value are left out. */
export interface IReceiptLine {
	label: string;
	value: string | null | undefined;
}

/** One payment of the invoice, as the receipt's table lists it. */
export interface IReceiptPaymentRow {
	date: string;
	method: string;
	amount: string;
	isCurrent: boolean;
}

/** Everything the receipt prints, already translated and formatted by the page. */
export interface IPaymentReceipt {
	/** The page's language, for the document's `lang`, and whether it reads right to left. */
	lang: string;
	rtl: boolean;
	/** Who issues it: the organization the invoice is from, or the one selected. */
	organization: string | null;
	/** "Payment receipt". */
	title: string;
	/** "Printed November 25, 2026". */
	printedOn: string;
	/** "Payment from Acme". */
	heading: string;
	amountLabel: string;
	amount: string;
	/** The payment's own facts: date, method, contact, project, recorded by, note. */
	details: IReceiptLine[];
	/** The invoice it pays, when it pays one. */
	invoice: {
		title: string;
		lines: IReceiptLine[];
		paymentsTitle: string;
		columns: { date: string; method: string; amount: string };
		thisPayment: string;
		payments: IReceiptPaymentRow[];
	} | null;
}

/** Prints the receipt. Returns false when the frame could not be written. */
export function printPaymentReceipt(receipt: IPaymentReceipt): boolean {
	const frame = document.createElement('iframe');
	// Off-screen rather than `display: none`: a frame without a box does not always lay out, and a document that is
	// not laid out prints blank in some browsers.
	frame.setAttribute('aria-hidden', 'true');
	frame.style.position = 'fixed';
	frame.style.right = '0';
	frame.style.bottom = '0';
	frame.style.width = '0';
	frame.style.height = '0';
	frame.style.border = '0';
	frame.style.visibility = 'hidden';
	document.body.appendChild(frame);

	const doc = frame.contentDocument;
	if (!doc) {
		frame.remove();
		return false;
	}
	doc.open();
	doc.write(receiptDocument(receipt));
	doc.close();

	const run = () => {
		try {
			frame.contentWindow?.focus();
			frame.contentWindow?.print();
		} finally {
			// One browser's print dialog holds the tab until it closes, another's does not: a delay is the one way
			// that works in both to know the dialog has taken the frame.
			setTimeout(() => frame.remove(), 1000);
		}
	};
	// A document written at once may already be loaded.
	if (doc.readyState === 'complete') setTimeout(run);
	else frame.onload = run;
	return true;
}

/** The receipt as a whole HTML document. Every value is escaped: notes and names are typed by people. */
function receiptDocument(receipt: IPaymentReceipt): string {
	const lines = (items: IReceiptLine[]) =>
		items
			.filter((line) => line.value !== null && line.value !== undefined && `${line.value}`.trim() !== '')
			.map((line) => `<div class="line"><dt>${escape(line.label)}</dt><dd>${escape(line.value)}</dd></div>`)
			.join('');

	const invoice = receipt.invoice
		? `<section>
	<h2>${escape(receipt.invoice.title)}</h2>
	<dl>${lines(receipt.invoice.lines)}</dl>
	${
		receipt.invoice.payments.length
			? `<h3>${escape(receipt.invoice.paymentsTitle)}</h3>
	<table>
		<thead><tr>
			<th>${escape(receipt.invoice.columns.date)}</th>
			<th>${escape(receipt.invoice.columns.method)}</th>
			<th class="num">${escape(receipt.invoice.columns.amount)}</th>
		</tr></thead>
		<tbody>${receipt.invoice.payments
			.map(
				(row) => `<tr${row.isCurrent ? ' class="current"' : ''}>
			<td>${escape(row.date)}${row.isCurrent ? ` <span class="note">${escape(receipt.invoice.thisPayment)}</span>` : ''}</td>
			<td>${escape(row.method)}</td>
			<td class="num">${escape(row.amount)}</td>
		</tr>`
			)
			.join('')}</tbody>
	</table>`
			: ''
	}
</section>`
		: '';

	return `<!doctype html>
<html lang="${escape(receipt.lang)}" dir="${receipt.rtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<title>${escape(receipt.title)}</title>
<style>
	@page { margin: 16mm; }
	* { box-sizing: border-box; }
	body { margin: 0; font: 10pt/1.45 -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1a1a1f; }
	header { display: flex; justify-content: space-between; align-items: baseline; gap: 8mm;
		padding-bottom: 4mm; border-bottom: 1px solid #d9d9de; margin-bottom: 7mm; }
	.org { font-size: 12pt; font-weight: 600; }
	.title { font-size: 9pt; color: #5c5c66; text-align: end; }
	.heading { font-size: 11pt; margin: 0 0 1mm; }
	.amount-label { font-size: 8pt; color: #5c5c66; text-transform: uppercase; letter-spacing: 0.02em; }
	.amount { font-size: 20pt; font-weight: 700; margin: 0 0 6mm; font-variant-numeric: tabular-nums; }
	section { margin-top: 7mm; break-inside: avoid; }
	h2 { font-size: 11pt; margin: 0 0 3mm; }
	h3 { font-size: 9pt; color: #5c5c66; font-weight: 500; margin: 5mm 0 2mm; }
	dl { margin: 0; }
	.line { display: flex; gap: 6mm; padding: 1.6mm 0; border-bottom: 1px solid #ececf0; }
	.line dt { flex: 0 0 38mm; color: #5c5c66; }
	.line dd { margin: 0; flex: 1 1 auto; white-space: pre-wrap; font-variant-numeric: tabular-nums; }
	table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
	th { font-size: 8pt; font-weight: 500; color: #5c5c66; text-align: start; padding: 1.6mm 2mm; border-bottom: 1px solid #d9d9de; }
	td { padding: 1.6mm 2mm; border-bottom: 1px solid #ececf0; }
	.num { text-align: end; }
	tr.current td { font-weight: 600; }
	.note { font-weight: 400; color: #5c5c66; font-size: 8pt; }
</style>
</head>
<body>
<header>
	<div class="org">${escape(receipt.organization || '')}</div>
	<div class="title">${escape(receipt.title)}<br>${escape(receipt.printedOn)}</div>
</header>
<p class="heading">${escape(receipt.heading)}</p>
<div class="amount-label">${escape(receipt.amountLabel)}</div>
<div class="amount">${escape(receipt.amount)}</div>
<dl>${lines(receipt.details)}</dl>
${invoice}
</body>
</html>`;
}

function escape(value: unknown): string {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}
