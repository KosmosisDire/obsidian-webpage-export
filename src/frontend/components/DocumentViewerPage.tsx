import { createMemo } from 'solid-js';
import { DocumentViewer } from '@shared/components/DocumentViewer';
import { vaultStore } from '../data/store';

interface DocumentViewerPageProps {
  path?: string;
}

export function DocumentViewerPage(props?: DocumentViewerPageProps) {
  
  const fileData = createMemo(() => {
    const path = props?.path || '';
    
    if (!path) {
      console.warn('No file path provided');
      return null;
    }
    
    const fileData = vaultStore.getFile(path);
    if (!fileData) {
      console.warn(`File not found: ${path}`);
      return null;
    }
    
    console.log('Loaded page:', fileData.path);
    return fileData;
  });

  return (
    <DocumentViewer 
      fileData={fileData()}
      error={vaultStore.error}
      isLoading={vaultStore.loading}
    />
  );
}
