import {App, PluginSettingTab, Setting} from "obsidian";
import type FunnelerApiPlugin from "./main";

export interface FunnelerApiSettings {
	apiToken: string;
}

export const DEFAULT_SETTINGS: FunnelerApiSettings = {
	apiToken: "",
};

export const PRODUCTION_URL = "https://api.funnelerapp.com";
export const DEVELOPMENT_URL = "http://api.lvh.me:3002";

declare const IS_PRODUCTION: boolean;

export function getHostUrl(): string {
	if (IS_PRODUCTION) {
		return PRODUCTION_URL;
	}
	return DEVELOPMENT_URL;
}

export class FunnelerApiSettingTab extends PluginSettingTab {
	plugin: FunnelerApiPlugin;

	constructor(app: App, plugin: FunnelerApiPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		this.containerEl.empty();

		new Setting(this.containerEl)
			.setName("API token")
			.setDesc("Bearer token for the broadcast mail API")
			.addText((text) => {
				text.inputEl.type = "password";
				text.setPlaceholder("トークンを入力")
					.setValue(this.plugin.settings.apiToken)
					.onChange(async (value: string) => {
						this.plugin.settings.apiToken = value;
						await this.plugin.saveSettings();
					});
			});
	}
}
