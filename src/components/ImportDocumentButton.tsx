import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';

interface ImportDocumentButtonProps {
  onImported?: () => void;
}

const ImportDocumentButton: React.FC<ImportDocumentButtonProps> = ({ onImported }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      // Store imported content in sessionStorage so the editor can pick it up
      sessionStorage.setItem('rb_imported_content', text);
      toast.success(`Imported "${file.name}"`);
      onImported?.();
    } catch {
      toast.error('Failed to read file');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".txt,.md,.docx"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button variant="outline" size="sm" onClick={handleClick} className="gap-1.5">
        <Upload className="w-4 h-4" />
        Import
      </Button>
    </>
  );
};

export default ImportDocumentButton;
