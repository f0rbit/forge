export const fuzzy_score = (query: string, target: string): number | null => {
	if (query.length === 0) return 0;
	const q = query.toLowerCase();
	const t = target.toLowerCase();
	let qi = 0;
	let score = 0;
	let prev_match = -2;
	let consecutive = 0;
	for (let ti = 0; ti < t.length && qi < q.length; ti++) {
		if (t[ti] !== q[qi]) continue;
		let bonus = 1;
		if (ti === 0) bonus += 5;
		if (ti > 0) {
			const prev = t[ti - 1] as string;
			if (prev === "." || prev === "-" || prev === "_" || prev === " ") bonus += 3;
		}
		if (ti === prev_match + 1) {
			consecutive += 1;
			bonus += consecutive * 2;
		} else {
			consecutive = 0;
		}
		score += bonus;
		prev_match = ti;
		qi += 1;
	}
	if (qi < q.length) return null;
	score -= t.length - q.length;
	return score;
};

export const fuzzy_rank = <T>(items: readonly T[], query: string, key: (t: T) => string): readonly { item: T; score: number }[] => {
	const hits: { item: T; score: number }[] = [];
	for (const item of items) {
		const s = fuzzy_score(query, key(item));
		if (s === null) continue;
		hits.push({ item, score: s });
	}
	hits.sort((a, b) => b.score - a.score);
	return hits;
};
