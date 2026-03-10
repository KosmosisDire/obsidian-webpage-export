export enum DocumentType {
    Markdown = "markdown",
    Canvas = "canvas",
    Excalidraw = "excalidraw",
    Kanban = "kanban",
    Attachment = "attachment",
    Other = "other",
}

export interface FileData {
    path: string;
    modified: number;
    exported: number;
    frontmatter: any;
    content: {
        markdown: string;
        html: string;
    };
    links: {
        outgoing: Record<string, number>;
        incoming: string[];
        unresolved: Record<string, number>;
        embeds: string[];
    };
    elements: {
        headers: Array<{ text: string; html?: string; level: number; id: string }>;
        tags: string[];
        blocks: string[];
        lists: number;
    };
    treeOrder?: number;
    type?: string;
    title?: string;
    icon?: string;
    description?: string;
    author?: string;
    aliases?: string[];
}

export interface FolderData {
    path: string;
    title: string;
    icon?: string;
}

export interface ExportData {
    export: {
        version: string;
        timestamp: number;
        vault: string;
        totalFiles: number;
    };
    files: Record<string, FileData>;
    folders?: Record<string, FolderData>;
    indices: {
        search?: any;
        graph: {
            nodes: Array<{ id: string; group: string }>;
            edges: Array<{ source: string; target: string; type: string }>;
        };
        tags: Record<string, string[]>;
    };
    filePathMapping: Record<string, string>;
    bodyClasses?: string;
    themeName?: string;
}

// Alias for frontend compatibility
export type WebsiteData = ExportData;
