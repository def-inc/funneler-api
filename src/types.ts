export interface ImageReference {
	filename: string;
	originalMatch: string;
}

export interface ResolvedImage {
	filename: string;
	data: ArrayBuffer;
}

export type BroadcastStatus = "draft" | "send";

export interface BroadcastFrontmatter {
	id?: number;
	subject?: string;
	tenant_email_id?: number;
	tag_ids?: number[];
	scheduled_at?: string;
	status?: BroadcastStatus;
	url?: string;
	created_at?: string;
	updated_at?: string;
}

export interface BroadcastMailResponse {
	id: number;
	status: string;
	url: string;
	created_at: string;
	updated_at: string;
}

export interface BroadcastMailErrorResponse {
	errors: string[];
}
