import {App, TFile} from "obsidian";
import type {ImageReference, ResolvedImage} from "../types";

export async function resolveImages(
	app: App,
	references: ImageReference[],
	sourcePath: string,
): Promise<ResolvedImage[]> {
	const resolved: ResolvedImage[] = [];

	for (const ref of references) {
		// Try resolving with sourcePath context first (handles relative paths)
		let file = app.metadataCache.getFirstLinkpathDest(ref.filename, sourcePath);

		// Fallback: try getAbstractFileByPath for full vault paths
		if (!(file instanceof TFile)) {
			const abstract = app.vault.getAbstractFileByPath(ref.filename);
			if (abstract instanceof TFile) {
				file = abstract;
			}
		}

		if (file instanceof TFile) {
			const data = await app.vault.readBinary(file);
			resolved.push({filename: file.name, data});
		} else {
			console.warn(`[funneler-api] Image not found in vault: ${ref.filename}`);
		}
	}

	return resolved;
}
