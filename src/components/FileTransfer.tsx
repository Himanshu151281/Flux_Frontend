import { Progress } from '@/components/ui/progress';
import { ArrowDown } from 'lucide-react';

interface FileTransferProps {
  progress: number;
}

const FileTransfer = ({ progress }: FileTransferProps) => {
  return (
    <div className="rounded-xl border p-5 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="flex items-center gap-4 mb-4">
        <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <ArrowDown className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <p className="text-sm font-medium">File Transfer in Progress</p>
          <p className="text-xs text-muted-foreground">{progress}% complete</p>
        </div>
      </div>
      
      <div className="relative pt-1">
        <Progress value={progress} className="h-3 rounded-full bg-blue-100" indicatorClassName="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full" />
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>0%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
};

export default FileTransfer;
