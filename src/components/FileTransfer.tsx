import { Progress } from '@/components/ui/progress';
import { ArrowDown } from 'lucide-react';

interface FileTransferProps {
  progress: number;
}

const FileTransfer = ({ progress }: FileTransferProps) => {
  return (
    <div className="border rounded-lg p-4 bg-muted/10">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-8 w-8 bg-primary/20 rounded-full flex items-center justify-center">
          <ArrowDown className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">File Transfer in Progress</p>
          <p className="text-xs text-muted-foreground">{progress}% complete</p>
        </div>
      </div>
      
      <Progress value={progress} className="h-2" />
    </div>
  );
};

export default FileTransfer;
