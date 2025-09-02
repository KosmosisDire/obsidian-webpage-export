export interface FileData {
    path: string;
    modified: number;
    exported: number;
    frontmatter: any;
    content: {
        markdown: string;
        html: string;
    };
    // Plugin-specific data - always present in plugin, may be missing in frontend
    links: {
        outgoing: Record<string, number>;
        incoming: string[];
        unresolved: Record<string, number>;
        embeds: string[];
    };
    elements: {
        headers: Array<{ text: string; level: number }>;
        tags: string[];
        blocks: string[];
        lists: number;
    };
    // Frontend-specific data (optional for plugin compatibility)
    treeOrder?: number;
}

export interface ExportData {
    export: {
        version: string;
        timestamp: number;
        vault: string;
        totalFiles: number;
    };
    files: Record<string, FileData>;
    indices: {
        search?: any;
        graph: {
            nodes: Array<{ id: string; group: string }>;
            edges: Array<{ source: string; target: string; type: string }>;
        };
        tags: Record<string, string[]>;
    };
}

// Alias for frontend compatibility
export type WebsiteData = ExportData;