import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

interface ConnectionProps {
  id: string;
  status: 'connecting' | 'connected' | 'disconnected';
  peer?: RTCPeerConnection;
}

interface ConnectionStatusProps {
  connection: ConnectionProps;
}

const ConnectionStatus = ({ connection }: ConnectionStatusProps) => {
  const getStatusColor = () => {
    switch (connection.status) {
      case 'connected':
        return 'bg-green-500/20 text-green-600 border-green-400';
      case 'connecting':
        return 'bg-yellow-500/20 text-yellow-600 border-yellow-400';
      case 'disconnected':
        return 'bg-red-500/20 text-red-600 border-red-400';
      default:
        return 'bg-slate-500/20 text-slate-600 border-slate-400';
    }
  };

  const getStatusText = () => {
    switch (connection.status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  const getStatusIcon = () => {
    switch (connection.status) {
      case 'connected':
        return <Wifi className="h-4 w-4" />;
      case 'connecting':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'disconnected':
        return <WifiOff className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="border rounded-lg p-3 bg-muted/20">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm font-medium">Connection Status</p>
          <p className="text-xs text-muted-foreground">ID: {connection.id}</p>
        </div>
        <Badge className={`flex items-center gap-1.5 ${getStatusColor()}`}>
          {getStatusIcon()}
          {getStatusText()}
        </Badge>
      </div>
    </div>
  );
};

export default ConnectionStatus;
