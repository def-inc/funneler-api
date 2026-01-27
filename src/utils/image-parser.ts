import type {ImageReference} from "../types";

export function parseImageReferences(content: string): ImageReference[] {
	const references: ImageReference[] = [];
	const seen = new Set<string>();

	// Obsidian: ![[file.png]], ![[file.png|100x200]], ![[file.png|alt]]
	const obsidianRegex = /!\[\[([^\]|]+?)(?:\|[^\]]*?)?\]\]/g;
	let match: RegExpExecArray | null;
	while ((match = obsidianRegex.exec(content)) !== null) {
		const filename = match[1]?.trim();
		if (!filename) continue;
		if (!seen.has(filename)) {
			seen.add(filename);
			references.push({filename, originalMatch: match[0]});
		}
	}

	// Standard markdown: ![alt](file.png)
	const markdownRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
	while ((match = markdownRegex.exec(content)) !== null) {
		const raw = match[2]?.trim();
		if (!raw) continue;
		if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
			const filename = decodeURIComponent(raw);
			if (!seen.has(filename)) {
				seen.add(filename);
				references.push({filename, originalMatch: match[0]});
			}
		}
	}

	return references;
}
