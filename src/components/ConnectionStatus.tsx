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
        return 'bg-green-100 text-green-700 border-green-200';
      case 'connecting':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'disconnected':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusBg = () => {
    switch (connection.status) {
      case 'connected':
        return 'bg-green-50 border-green-100';
      case 'connecting':
        return 'bg-yellow-50 border-yellow-100';
      case 'disconnected':
        return 'bg-red-50 border-red-100';
      default:
        return 'bg-gray-50 border-gray-100';
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
    <div className={`rounded-xl p-4 border shadow-sm ${getStatusBg()}`}>
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm font-medium mb-1">Connection Status</p>
          <div className="flex items-center gap-1.5">
            <div className="font-mono bg-white px-2 py-0.5 text-xs rounded border">
              {connection.id.substring(0, 12)}
            </div>
          </div>
        </div>
        <Badge variant="outline" className={`flex items-center gap-1.5 px-3 py-1.5 ${getStatusColor()}`}>
          {getStatusIcon()}
          <span className="font-medium">{getStatusText()}</span>
        </Badge>
      </div>
    </div>
  );
};

export default ConnectionStatus;
