export type ProgrammeInfo = {
	progStructCode: string;
	progStructCodeDesc: string;
	year: string;
	class: string;
};

export function programmeInfoFromUserInfo(userInfo: {
	progStructCode?: string | null;
	progStructCodeDesc?: string | null;
	year?: string | null;
	class?: string | null;
}): ProgrammeInfo | null {
	const progStructCode = userInfo.progStructCode?.trim() || "";
	const progStructCodeDesc = userInfo.progStructCodeDesc?.trim() || "";
	const year = userInfo.year?.trim() || "";
	const classGroup = userInfo.class?.trim() || "";
	if (!progStructCode && !progStructCodeDesc && !year && !classGroup) return null;
	return { progStructCode, progStructCodeDesc, year, class: classGroup };
}
