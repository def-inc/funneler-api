import {App, Modal, Notice, Setting, TFile} from "obsidian";
import type FunnelerApiPlugin from "../main";
import {clearTenantEmailsCache, fetchTenantEmails} from "../api/options-client";
import type {BroadcastFrontmatter} from "../types";

export class FrontmatterSelectModal extends Modal {
	private file: TFile;
	private plugin: FunnelerApiPlugin;

	constructor(app: App, file: TFile, plugin: FunnelerApiPlugin) {
		super(app);
		this.file = file;
		this.plugin = plugin;
	}

	onOpen(): void {
		void this.render();
	}

	private async render(): Promise<void> {
		const {contentEl} = this;
		contentEl.empty();

		contentEl.createEl("h3", {text: this.file.basename});
		const loadingEl = contentEl.createEl("p", {text: "Loading..."});

		// Clear cache to fetch latest options from API
		clearTenantEmailsCache();

		const cache = this.app.metadataCache.getFileCache(this.file);
		const fm = (cache?.frontmatter ?? {}) as BroadcastFrontmatter;

		await this.renderTenantEmailSelect(contentEl, fm);
		this.renderStatusSelect(contentEl, fm);

		loadingEl.remove();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async renderTenantEmailSelect(
		containerEl: HTMLElement,
		fm: BroadcastFrontmatter,
	): Promise<void> {
		let options: { value: string; label: string }[];
		try {
			options = await fetchTenantEmails(this.plugin.settings);
		} catch (e) {
			const msg = e instanceof Error ? e.message : "取得エラー";
			new Notice(`tenant_email_id: ${msg}`);
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
					await this.app.fileManager.processFrontMatter(this.file, (fmData: Record<string, unknown>) => {
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
					await this.app.fileManager.processFrontMatter(this.file, (fmData: Record<string, unknown>) => {
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
