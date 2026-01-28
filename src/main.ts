import {MarkdownView, Notice, Plugin} from "obsidian";
import {DEFAULT_SETTINGS, FunnelerApiSettingTab} from "./settings";
import type {FunnelerApiSettings} from "./settings";
import type {BroadcastFrontmatter} from "./types";
import {parseImageReferences} from "./utils/image-parser";
import {resolveImages} from "./utils/image-resolver";
import {sendBroadcastMail, updateBroadcastMail} from "./api/client";

export default class FunnelerApiPlugin extends Plugin {
	settings: FunnelerApiSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "send-as-broadcast-mail",
			name: "Send current note as broadcast mail",
			checkCallback: (checking: boolean) => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view) return false;
				if (!checking) {
					void this.sendCurrentNote(view);
				}
				return true;
			},
		});

		this.addSettingTab(new FunnelerApiSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<FunnelerApiSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async sendCurrentNote(view: MarkdownView) {
		if (!this.settings.apiToken) {
			new Notice("APIトークンが設定されていません。設定画面で入力してください。");
			return;
		}

		const file = view.file;
		if (!file) {
			new Notice("アクティブなファイルがありません。");
			return;
		}

		try {
			const cache = this.app.metadataCache.getFileCache(file);
			const fm = (cache?.frontmatter ?? {}) as BroadcastFrontmatter;

			const missing: string[] = [];
			if (!fm.subject) missing.push("subject");
			if (!fm.tenant_email_id) missing.push("tenant_email_id");
			if (!fm.scheduled_at) missing.push("scheduled_at");
			if (!fm.status) missing.push("status");
			if (missing.length > 0) {
				new Notice(`frontmatter に必須項目がありません: ${missing.join(", ")}`);
				return;
			}
			if (fm.status !== "draft" && fm.status !== "send") {
				new Notice('Status must be "draft" or "send"');
				return;
			}

			new Notice("Sending broadcast mail...");

			const rawContent = await this.app.vault.read(file);
			const fmEnd = cache?.frontmatterPosition?.end?.line;
			const content = fmEnd != null
				? rawContent.split("\n").slice(fmEnd + 1).join("\n").trimStart()
				: rawContent;

			const imageRefs = parseImageReferences(content);
			const resolvedImages = await resolveImages(this.app, imageRefs, file.path);

			if (resolvedImages.length < imageRefs.length) {
				const missingFiles = imageRefs
					.filter(ref => !resolvedImages.some(r => r.filename === ref.filename))
					.map(ref => ref.filename);
				for (const name of missingFiles) {
					new Notice(`画像が見つかりません: ${name}`);
				}
				return;
			}

			const mailParams = {
				content,
				images: resolvedImages,
				settings: this.settings,
				frontmatter: fm,
			};

			const existingId = fm.id as number | undefined;
			const result = existingId
				? await updateBroadcastMail(existingId, mailParams)
				: await sendBroadcastMail(mailParams);

			await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
				fm["id"] = result.id;
				fm["url"] = result.url;
				fm["created_at"] = result.created_at;
				fm["updated_at"] = result.updated_at;
			});

			new Notice(`BroadcastMail 下書きを作成しました (ID: ${result.id})`);
		} catch (error) {
			const message = error instanceof Error ? error.message : "不明なエラーが発生しました";
			for (const line of message.split("\n")) {
				new Notice(`送信失敗: ${line}`);
			}
			console.error("[funneler-api]", error);
		}
	}
}
