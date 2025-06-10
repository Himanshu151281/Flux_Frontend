import { FileText, Github, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  myId?: string;
}

const Header = ({ myId }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-50 w-full bg-white shadow-sm border-b border-gray-100">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Flux
              </h1>
              <p className="text-xs font-bold text-foreground">Fast & secure file sharing</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {myId && (
              <div className="hidden md:flex items-center text-sm px-3 py-1.5 bg-secondary rounded-full text-muted-foreground">
                <span className="text-gray-900 font-bold mr-1.5">ID:</span> 
                <span className="font-mono text-foreground">{myId.substring(0, 8)}</span>
              </div>
            )}
            <Button variant="ghost" size="sm" className="rounded-full w-9 h-9 p-0">
              <Info className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="rounded-full w-9 h-9 p-0">
              <Github className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
