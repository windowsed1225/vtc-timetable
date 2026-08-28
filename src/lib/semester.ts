export const SEMESTER_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type SemesterNumber = (typeof SEMESTER_NUMBERS)[number];
/** Stored in Mongo as 1–9. Display as `SEM ${n}`. */
export type SemesterType = SemesterNumber;

export type ProgrammeKind = "dfs" | "hd" | "dve" | "unknown";

export type SemesterI18nKey =
	| "sem1Label"
	| "sem2Label"
	| "sem3Label"
	| "sem4Label"
	| "sem5Label"
	| "sem6Label"
	| "sem7Label"
	| "sem8Label"
	| "sem9Label";

export const SEMESTER_I18N_KEYS: Record<SemesterNumber, SemesterI18nKey> = {
	1: "sem1Label",
	2: "sem2Label",
	3: "sem3Label",
	4: "sem4Label",
	5: "sem5Label",
	6: "sem6Label",
	7: "sem7Label",
	8: "sem8Label",
	9: "sem9Label",
};

export const SEMESTER_ORDER: Record<string, number> = Object.fromEntries(
	SEMESTER_NUMBERS.map((n) => [`SEM ${n}`, n]),
);

export function semesterTag(n: SemesterNumber | number): string {
	return `SEM ${n}`;
}

export function normalizeSemester(value: unknown): SemesterNumber | null {
	if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 9) {
		return value as SemesterNumber;
	}
	if (typeof value === "string") {
		const match = value.trim().match(/(\d+)/);
		if (!match) return null;
		const n = Number(match[1]);
		if (n >= 1 && n <= 9) return n as SemesterNumber;
	}
	return null;
}

export function isSemesterType(value: unknown): value is SemesterNumber {
	return normalizeSemester(value) !== null;
}

/**
 * DFS — Diploma of Foundation Studies (1 year, 1–3)
 * HD  — Higher Diploma (2 years, 1–5)
 * DVE — Youth College Diploma of Vocational Education (3 years, 1–9)
 */
export function detectProgrammeKind(...texts: Array<string | null | undefined>): ProgrammeKind {
	const haystack = texts.filter(Boolean).join("\n");
	if (!haystack) return "unknown";
	if (
		/diploma of vocational education|\bdve\b|youth college|\byc\b|職專文憑|職業專才|青年學院/i.test(
			haystack,
		)
	) {
		return "dve";
	}
	if (/^[\s]*higher diploma|\bhigher diploma\b|\bhd\b|高級文憑/i.test(haystack)) {
		return "hd";
	}
	if (
		/diploma of foundation studies|\bfoundation\b|\bdfs\b|基礎課程文憑|基礎文憑/i.test(haystack)
	) {
		return "dfs";
	}
	return "unknown";
}

export function programmeYearCount(kind: ProgrammeKind): 1 | 2 | 3 {
	if (kind === "dve") return 3;
	if (kind === "hd") return 2;
	return 1;
}

export function getSemesterLabel(semNum: number): SemesterNumber {
	const n = normalizeSemester(semNum);
	return n ?? 2;
}

/** Academic year starts in September. Jan 2026 → 2025, Sep 2025 → 2025. */
export function academicYearStartYear(date: Date): number {
	const month = date.getMonth() + 1;
	const year = date.getFullYear();
	return month >= 9 ? year : year - 1;
}

export function monthToSeasonSlot(month: number): 1 | 2 | 3 {
	if (month >= 9 && month <= 12) return 1;
	if (month >= 1 && month <= 4) return 2;
	return 3;
}

/**
 * VTC student numbers start with intake year: 250083235 → 2025, 26xxxxxxx → 2026.
 * That intake year is academic-year 1 (the Fall they entered).
 */
export function parseIntakeAcademicYear(studentId: string | null | undefined): number | null {
	if (!studentId) return null;
	const digits = studentId.trim().replace(/\D/g, "");
	if (digits.length < 7) return null;
	const yy = Number(digits.slice(0, 2));
	if (!Number.isInteger(yy) || yy < 0 || yy > 99) return null;
	return yy <= 50 ? 2000 + yy : 1900 + yy;
}

export function studyYearFromStudentId(studentId: string, date: Date = new Date()): 1 | 2 | 3 | null {
	const intake = parseIntakeAcademicYear(studentId);
	if (intake === null) return null;
	const year = academicYearStartYear(date) - intake + 1;
	if (year < 1) return 1;
	if (year > 3) return 3;
	return year as 1 | 2 | 3;
}

/** E-card `year` fallback such as "1", "2", "Year 3". Prefer student ID. */
export function parseStudyYear(raw: string | null | undefined): 1 | 2 | 3 | null {
	if (!raw) return null;
	const match = raw.trim().match(/^(?:year\s*)?([123])(?:st|nd|rd)?$/i);
	if (!match) return null;
	return Number(match[1]) as 1 | 2 | 3;
}

export function resolveProgrammeStartAcademicYear(options: {
	now?: Date;
	intakeYear?: number | null;
	studyYear?: 1 | 2 | 3 | null;
	kind?: ProgrammeKind;
	earliestDate?: Date | null;
	latestDate?: Date | null;
}): number {
	if (options.intakeYear) return options.intakeYear;

	const earliestAY = options.earliestDate ? academicYearStartYear(options.earliestDate) : null;
	const latestAY = options.latestDate ? academicYearStartYear(options.latestDate) : earliestAY;
	const studyYear = options.studyYear ?? 1;
	const anchor = latestAY ?? academicYearStartYear(options.now ?? new Date());

	if (studyYear <= 1) {
		return earliestAY ?? anchor;
	}

	if (earliestAY !== null && latestAY !== null && latestAY > earliestAY) {
		return earliestAY;
	}
	return anchor - (studyYear - 1);
}

/**
 * DFS (1 year): 1 Fall, 2 Spring, 3 Summer.
 * HD (2 years): 1–3 then 4 Y2 Fall, 5 Y2 Spring (no separate Y2 summer).
 * DVE (3 years): 1–3, 4–6, 7–9.
 */
export function programmeSemesterFromDate(
	date: Date,
	programmeStartAcademicYear: number,
	kind: ProgrammeKind = "unknown",
): SemesterNumber {
	const years = programmeYearCount(kind);
	const yearIndex = Math.min(
		years - 1,
		Math.max(0, academicYearStartYear(date) - programmeStartAcademicYear),
	);
	const slot = monthToSeasonSlot(date.getMonth() + 1);
	if (kind === "hd" && yearIndex >= 1) {
		return slot === 1 ? 4 : 5;
	}
	return (yearIndex * 3 + slot) as SemesterNumber;
}

export function programmeSemesterFromVtcDate(
	dateStr: string,
	programmeStartAcademicYear: number,
	kind: ProgrammeKind = "unknown",
	fallback: SemesterNumber = 2,
): SemesterNumber {
	const parts = dateStr.trim().split(/[/\-]/);
	if (parts.length < 3) return fallback;
	let year: number;
	let month: number;
	if (parts[0].length === 4) {
		year = Number(parts[0]);
		month = Number(parts[1]);
	} else {
		year = Number(parts[2]);
		month = Number(parts[1]);
	}
	if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return fallback;
	return programmeSemesterFromDate(new Date(year, month - 1, 15), programmeStartAcademicYear, kind);
}

export function semesterEndDate(
	semester: SemesterNumber,
	programmeStartAcademicYear: number,
): Date {
	const yearIndex = Math.floor((semester - 1) / 3);
	const slot = (((semester - 1) % 3) + 1) as 1 | 2 | 3;
	if (semester === 5 && yearIndex === 1) {
		return new Date(programmeStartAcademicYear + 2, 4, 31, 23, 59, 59);
	}
	const ay = programmeStartAcademicYear + yearIndex;
	if (slot === 1) return new Date(ay, 11, 31, 23, 59, 59);
	if (slot === 2) return new Date(ay + 1, 4, 31, 23, 59, 59);
	return new Date(ay + 1, 7, 31, 23, 59, 59);
}

export function jumpMonthForSemester(semester: string | number, now: Date = new Date()): Date {
	const n = normalizeSemester(semester);
	const year = now.getFullYear();
	const month = now.getMonth() + 1;
	const slot = n ? ((((n - 1) % 3) + 1) as 1 | 2 | 3) : monthToSeasonSlot(month);
	if (slot === 1) return new Date(month >= 8 ? year : year - 1, 8, 1);
	if (slot === 2) return new Date(year, 0, 1);
	return new Date(year, 4, 1);
}

export function semesterI18nKey(value: string | number | null | undefined): SemesterI18nKey {
	const n = normalizeSemester(value) ?? 2;
	return SEMESTER_I18N_KEYS[n];
}
