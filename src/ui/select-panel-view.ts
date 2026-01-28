import {ItemView, MarkdownView, Setting, TFile, WorkspaceLeaf} from "obsidian";
import type FunnelerApiPlugin from "../main";
import {fetchTenantEmails} from "../api/options-client";
import type {BroadcastFrontmatter} from "../types";

export const VIEW_TYPE_FRONTMATTER_SELECT = "funneler-frontmatter-select";

export class FrontmatterSelectView extends ItemView {
	private plugin: FunnelerApiPlugin;
	private currentFile: TFile | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: FunnelerApiPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_FRONTMATTER_SELECT;
	}

	getDisplayText(): string {
		return "Frontmatter select";
	}

	getIcon(): string {
		return "list";
	}

	async onOpen(): Promise<void> {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		this.currentFile = view?.file ?? null;
		await this.render();
	}

	async refresh(file: TFile): Promise<void> {
		this.currentFile = file;
		await this.render();
	}

	private async render(): Promise<void> {
		const {contentEl} = this;
		contentEl.empty();

		const file = this.currentFile;
		if (!file) {
			contentEl.createEl("p", {text: "マークダウンファイルを開いてください。", cls: "funneler-panel-empty"});
			return;
		}

		const cache = this.app.metadataCache.getFileCache(file);
		const fm = (cache?.frontmatter ?? {}) as BroadcastFrontmatter;

		contentEl.createEl("h4", {text: file.basename, cls: "funneler-panel-title"});

		await this.renderTenantEmailSelect(contentEl, file, fm);
		this.renderStatusSelect(contentEl, file, fm);
	}

	private async renderTenantEmailSelect(
		containerEl: HTMLElement,
		file: TFile,
		fm: BroadcastFrontmatter,
	): Promise<void> {
		let options: { value: string; label: string }[];
		try {
			options = await fetchTenantEmails(this.plugin.settings);
		} catch (e) {
			const msg = e instanceof Error ? e.message : "取得エラー";
			containerEl.createEl("p", {text: `tenant_email_id: ${msg}`, cls: "funneler-panel-error"});
			return;
		}

		const currentValue = fm.tenant_email_id != null ? String(fm.tenant_email_id) : "";

		new Setting(containerEl)
			.setName("Tenant email")
			.addDropdown((dropdown) => {
				dropdown.addOption("", "-- 選択 --");
				for (const opt of options) {
					dropdown.addOption(opt.value, opt.label);
				}
				dropdown.setValue(currentValue);
				dropdown.onChange(async (value: string) => {
					const numValue = value ? Number(value) : undefined;
					await this.app.fileManager.processFrontMatter(file, (fmData: Record<string, unknown>) => {
						if (numValue != null) {
							fmData["tenant_email_id"] = numValue;
						} else {
							delete fmData["tenant_email_id"];
						}
					});
				});
			});
	}

	private renderStatusSelect(
		containerEl: HTMLElement,
		file: TFile,
		fm: BroadcastFrontmatter,
	): void {
		const currentValue = fm.status ?? "";

		new Setting(containerEl)
			.setName("Status")
			.addDropdown((dropdown) => {
				dropdown.addOption("", "-- 選択 --");
				dropdown.addOption("draft", "Draft");
				dropdown.addOption("send", "Send");
				dropdown.setValue(currentValue);
				dropdown.onChange(async (value: string) => {
					await this.app.fileManager.processFrontMatter(file, (fmData: Record<string, unknown>) => {
						if (value) {
							fmData["status"] = value;
						} else {
							delete fmData["status"];
						}
					});
				});
			});
	}
}
