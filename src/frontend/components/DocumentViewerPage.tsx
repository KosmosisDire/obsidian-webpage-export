import { createMemo } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { DocumentViewer } from '@shared/components';
import { vaultStore } from '../data/store';

interface DocumentViewerPageProps {
  path?: string;
}

export function DocumentViewerPage(props?: DocumentViewerPageProps) {
  const params = useParams();
  const navigate = useNavigate();
  
  // Get the file path from props or params
  const filePath = createMemo(() => {
    let path = props?.path || params.path || '';
    
    // Try to decode URL encoding, but handle malformed URIs
    if (path) {
      try {
        path = decodeURIComponent(path);
      } catch (error) {
        console.warn('Failed to decode URL, using original path:', path);
      }
    }
    
    // Convert HTML path back to MD path
    if (path.endsWith('.html')) {
      path = path.replace(/\.html$/, '.md');
    }
    
    // If no extension, try adding .md
    if (path && !path.includes('.') && !path.endsWith('/')) {
      path = path + '.md';
    }
    
    // Handle root path
    if (!path || path === '/' || path === '') {
      const files = vaultStore.getFileList();
      const homeFile = files.find(f => f.toLowerCase().includes('index') || f.toLowerCase().includes('home'));
      return homeFile || files[0] || null;
    }
    
    return path || null;
  });

  const fileData = createMemo(() => {
    const path = filePath();
    
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

  const handleLinkClick = (href: string) => {
    let targetPath = href;
    
    // Convert to proper path
    if (targetPath.endsWith('.html')) {
      targetPath = targetPath.replace(/\.html$/, '.md');
    }
    
    // Check if file exists
    if (vaultStore.documentExists(targetPath)) {
      const htmlPath = targetPath.replace(/\.md$/, '.html');
      navigate(`/${htmlPath}`);
    }
  };

  return (
    <DocumentViewer 
      fileData={fileData()}
      error={vaultStore.error}
      isLoading={vaultStore.loading}
      onLinkClick={handleLinkClick}
      checkDocumentExists={(path: string) => vaultStore.documentExists(path)}
    />
  );
}