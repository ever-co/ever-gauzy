/**
 * The vocabulary of a settlement schedule.
 *
 * Both enumerations are kernel, not plugin: a term is read by the accounting document and by
 * procurement alike, and the value set a schedule is described in cannot belong to whichever
 * capability happened to need it first.
 */

/**
 * How one instalment's `valueAmount` is read.
 *
 * A term is a header with an ordered list of instalments, and an instalment is either a share of the
 * document total or a fixed amount. Mixing the two is the ordinary commercial case — a deposit at
 * order, the balance on delivery — which is precisely what an integer `paymentTermsDays` column
 * cannot express.
 */
export enum PaymentTermLineType {
	/**
	 * `valueAmount` is a percentage of the document total, in `[0,100]`.
	 *
	 * The percentage lines of a term must total `100` when the term carries no fixed line, and the
	 * remainder after any fixed line is allocated across them proportionally, so the schedule sums to
	 * the document total exactly.
	 */
	PERCENT = 'PERCENT',
	/**
	 * `valueAmount` is an absolute amount, in the line's own `currency`.
	 *
	 * A fixed line must leave a non-negative remainder, or the derivation fails rather than producing a
	 * schedule that does not add up.
	 */
	FIXED = 'FIXED'
}

/**
 * The date an instalment's `days` offset is counted from.
 *
 * The four bases are the conventions a real B2B agreement uses, and they are an enumeration rather
 * than a set of nullable offset columns because exactly one of them applies to a line: the pairing
 * constraint the schema declares — `dayOfMonth` is non-null exactly when the basis is
 * `DAY_OF_NEXT_MONTH` — is what keeps a line from carrying two answers.
 */
export enum PaymentDueBasis {
	/** `days` added to the document's own basis date. */
	INVOICE_DATE = 'INVOICE_DATE',
	/** `days` added to the last day of the basis date's month. */
	END_OF_MONTH = 'END_OF_MONTH',
	/** `days` added to the last day of the following month. */
	END_OF_NEXT_MONTH = 'END_OF_NEXT_MONTH',
	/** The `dayOfMonth`-th day of the following month. Requires `dayOfMonth`. */
	DAY_OF_NEXT_MONTH = 'DAY_OF_NEXT_MONTH'
}
