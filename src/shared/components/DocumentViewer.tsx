import { createMemo, Show } from 'solid-js';
import { FileData } from '../types';

interface DocumentViewerProps {
  fileData: FileData | null;
  error?: string | null;
  isLoading?: boolean;
}

export function DocumentViewer(props: DocumentViewerProps) {
  const fileName = createMemo(() => {
    if (!props.fileData?.path) return 'Untitled';
    return props.fileData.path.split('/').pop()?.replace(/\.md$/, '') || 'Untitled';
  });

  return (
    <Show 
      when={props.fileData} 
      fallback={
        <div class="obsidian-document markdown-preview-view">
          <div class="view-content">
            <div class="markdown-reading-view">
              <div class="markdown-preview-view markdown-rendered">
                <div class="markdown-preview-section">
                  <Show when={props.error}>
                    <p class="error">Error loading content: {props.error}</p>
                  </Show>
                  <Show when={!props.error && props.isLoading}>
                    <p>Loading...</p>
                  </Show>
                  <Show when={!props.error && !props.isLoading}>
                    <p>File not found</p>
                  </Show>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    >
      {(file) => (
        <div class="obsidian-document markdown-preview-view" innerHTML={file().content?.html || '<p>No content available</p>'}></div>
      )}
    </Show>
  );
}