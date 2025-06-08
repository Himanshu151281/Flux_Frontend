import { FileText, Github, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  myId?: string;
}

const Header = ({ myId }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-50 w-full bg-background border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                Dark Pizza Forge
              </h1>
              <p className="text-xs text-muted-foreground">Secure file sharing</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {myId && (
              <div className="hidden md:block text-sm text-muted-foreground">
                ID: <span className="font-mono text-primary">{myId}</span>
              </div>
            )}
            <Button variant="ghost" size="sm">
              <Info className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="sm">
              <Github className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
