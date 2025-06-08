import { useState, useRef, useEffect } from 'react';
import Header from '@/components/Header';
import FileUpload from '@/components/FileUpload';
import FileTransfer from '@/components/FileTransfer';
import ConnectionStatus from '@/components/ConnectionStatus';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Share2, Download, FileText, Shield, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { io, Socket } from 'socket.io-client';

// API URL configuration from environment variables
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

interface FileData {
  id: string;
  name: string;
  size: number;
  type: string;
  data?: ArrayBuffer;
}

interface Connection {
  id: string;
  status: 'connecting' | 'connected' | 'disconnected';
  peer?: RTCPeerConnection;
}

// Add localStorage key constants at the top of the file, before the component
const LS_TRANSFER_KEY = 'dark_pizza_file_transfer';
const LS_CONNECT_KEY = 'dark_pizza_connection_request';

const Index = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [connectionId, setConnectionId] = useState<string>('');
  const [myId, setMyId] = useState<string>('');
  const [connection, setConnection] = useState<Connection | null>(null);
  const [transferProgress, setTransferProgress] = useState<number>(0);
  const [isTransferring, setIsTransferring] = useState<boolean>(false);
  const [receivedFiles, setReceivedFiles] = useState<FileData[]>([]);
  const [shareableLink, setShareableLink] = useState<string>('');
  const [availableFiles, setAvailableFiles] = useState<FileData[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const fileChunksRef = useRef<Uint8Array[]>([]);
  const { toast } = useToast();

  // Initialize WebRTC configuration
  const peerConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Initialize socket connection
  useEffect(() => {
    // Connect to socket.io server
    socketRef.current = io(SOCKET_URL);
    
    // Handle connection events
    socketRef.current.on('connect', () => {
      console.log('Socket connected with ID:', socketRef.current?.id);
      setMyId(socketRef.current?.id || '');
    });
    
    // Handle offer from peer
    socketRef.current.on('offer', async (data) => {
      console.log('Received offer from:', data.senderId);
      setConnection({
        id: data.senderId,
        status: 'connecting'
      });
      
      try {
        await handleOffer(data.senderId, data.offer);
        toast({
          title: "Connection request",
          description: `User ${data.senderId} wants to send you a file`,
        });
      } catch (error) {
        console.error('Error handling offer:', error);
        toast({
          title: "Connection failed",
          description: "Failed to establish connection",
          variant: "destructive",
        });
      }
    });
    
    // Handle answer from peer
    socketRef.current.on('answer', async (data) => {
      console.log('Received answer from:', data.senderId);
      try {
        if (peerRef.current) {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log('Set remote description success');
          setConnection(prev => prev ? { ...prev, status: 'connected' } : null);
        }
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    });
    
    // Handle ICE candidate from peer
    socketRef.current.on('ice-candidate', async (data) => {
      console.log('Received ICE candidate from:', data.senderId);
      try {
        if (peerRef.current) {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          console.log('Added ICE candidate success');
        }
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    });
    
    // Handle disconnection
    socketRef.current.on('disconnect', () => {
      console.log('Socket disconnected');
    });
    
    // Clean up socket connection
    return () => {
      cleanupPeerConnection();
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);
  
  // Handle URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const connectId = urlParams.get('connect');
    
    if (connectId && connectId !== myId) {
      console.log('Connection ID detected in URL:', connectId);
      setConnectionId(connectId);
      
      // Wait for socket connection to be established
      const timer = setTimeout(() => {
        if (socketRef.current?.connected && myId) {
          handleConnect(connectId);
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [myId]);
  
  // Initialize peer connection
  const initializePeerConnection = () => {
    cleanupPeerConnection();
    
    const peer = new RTCPeerConnection(peerConfiguration);
    peerRef.current = peer;
    
    // Handle ICE candidates
    peer.onicecandidate = (event) => {
      if (event.candidate && socketRef.current && connection) {
        console.log('Sending ICE candidate to:', connection.id);
        socketRef.current.emit('ice-candidate', {
          targetId: connection.id,
          senderId: myId,
          candidate: event.candidate
        });
      }
    };
    
    // Handle connection state changes
    peer.onconnectionstatechange = () => {
      console.log('Connection state changed:', peer.connectionState);
      if (peer.connectionState === 'connected') {
        setConnection(prev => prev ? { ...prev, status: 'connected' } : null);
      } else if (peer.connectionState === 'disconnected' || peer.connectionState === 'failed') {
        setConnection(prev => prev ? { ...prev, status: 'disconnected' } : null);
        cleanupPeerConnection();
      }
    };
    
    // Handle data channel (for receiver)
    peer.ondatachannel = (event) => {
      console.log('Data channel received');
      setupDataChannel(event.channel);
    };
    
    return peer;
  };
  
  // Setup data channel for file transfer
  const setupDataChannel = (channel: RTCDataChannel) => {
    dataChannelRef.current = channel;
    
    // Reset chunks when new connection is established
    fileChunksRef.current = [];
    
    channel.binaryType = 'arraybuffer';
    
    channel.onopen = () => {
      console.log('Data channel opened');
    };
    
    channel.onclose = () => {
      console.log('Data channel closed');
    };
    
    channel.onerror = (error) => {
      console.error('Data channel error:', error);
    };
    
    channel.onmessage = (event) => {
      const data = event.data;
      
      // Check if the message is JSON (metadata) or binary (file chunk)
      if (typeof data === 'string') {
        try {
          const message = JSON.parse(data);
          
          // Handle different message types
          if (message.type === 'file-start') {
            console.log('File transfer started:', message.fileName);
            fileChunksRef.current = []; // Reset chunks for new file
            setIsTransferring(true);
            setTransferProgress(0);
          } else if (message.type === 'file-end') {
            console.log('File transfer completed');
            // Combine all chunks and create file
            const fileData = {
              id: message.fileId || Math.random().toString(36).substring(2, 15),
              name: message.fileName,
              size: message.fileSize,
              type: message.fileType,
              data: concatenateArrayBuffers(fileChunksRef.current)
            };
            
            // Add to received files
            setReceivedFiles(prev => [...prev, fileData]);
            setIsTransferring(false);
            setTransferProgress(100);
            
            toast({
              title: "File received!",
              description: `${message.fileName} has been received successfully`,
            });
          } else if (message.type === 'progress') {
            setTransferProgress(message.progress);
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      } else if (data instanceof ArrayBuffer) {
        // Handle file chunk
        fileChunksRef.current.push(new Uint8Array(data));
      }
    };
  };
  
  // Combine array buffers into one
  const concatenateArrayBuffers = (arrays: Uint8Array[]) => {
    const totalLength = arrays.reduce((acc, value) => acc + value.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const array of arrays) {
      result.set(array, offset);
      offset += array.length;
    }
    
    return result.buffer;
  };
  
  // Handle incoming WebRTC offer
  const handleOffer = async (senderId: string, offer: RTCSessionDescriptionInit) => {
    const peer = initializePeerConnection();
    
    try {
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      
      if (socketRef.current) {
        socketRef.current.emit('answer', {
          targetId: senderId,
          senderId: myId,
          answer: answer
        });
      }
    } catch (error) {
      console.error('Error handling offer:', error);
      throw error;
    }
  };
  
  // Cleanup peer connection
  const cleanupPeerConnection = () => {
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
  };
  
  // Handle file selection
  const handleFileSelect = (file: File) => {
    console.log('File selected:', file);
    setSelectedFile(file);
    // Reset any previous transfer state
    setTransferProgress(0);
    setIsTransferring(false);
    setShareableLink('');
  };
  
  // Generate shareable link with connection ID
  const generateShareLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('connect', myId);
    setShareableLink(url.toString());
    
    // Copy to clipboard
    navigator.clipboard.writeText(url.toString())
      .then(() => {
        toast({
          title: "Link copied!",
          description: "Share this link with others to send your file",
        });
      })
      .catch(err => {
        console.error('Failed to copy link:', err);
      });
  };
  
  // Connect to another peer
  const handleConnect = async (targetId: string) => {
    if (!targetId.trim() || targetId === myId) {
      toast({
        title: "Invalid ID",
        description: "Please enter a valid connection ID",
        variant: "destructive",
      });
      return;
    }
    
    setConnection({
      id: targetId,
      status: 'connecting'
    });
    
    try {
      const peer = initializePeerConnection();
      
      // Create data channel for file transfer
      const dataChannel = peer.createDataChannel('fileTransfer');
      setupDataChannel(dataChannel);
      
      // Create and send offer
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      
      if (socketRef.current) {
        socketRef.current.emit('offer', {
          targetId: targetId,
          senderId: myId,
          offer: offer
        });
        
        toast({
          title: "Connection request sent",
          description: "Waiting for the other user to accept",
        });
      }
    } catch (error) {
      console.error('Error connecting to peer:', error);
      setConnection(prev => prev ? { ...prev, status: 'disconnected' } : null);
      
      toast({
        title: "Connection failed",
        description: "Failed to establish connection",
        variant: "destructive",
      });
    }
  };
  
  // Send file to connected peer
  const handleSendFile = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a file to send",
        variant: "destructive",
      });
      return;
    }
    
    if (!connection || connection.status !== 'connected' || !dataChannelRef.current) {
      toast({
        title: "Not connected",
        description: "Please connect to a peer first",
        variant: "destructive",
      });
      return;
    }
    
    const dataChannel = dataChannelRef.current;
    if (dataChannel.readyState !== 'open') {
      toast({
        title: "Channel not open",
        description: "The connection is not ready",
        variant: "destructive",
      });
      return;
    }
    
    setIsTransferring(true);
    setTransferProgress(0);
    
    try {
      // Send file metadata
      const fileMetadata = {
        type: 'file-start',
        fileId: Math.random().toString(36).substring(2, 15),
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        fileType: selectedFile.type
      };
      
      dataChannel.send(JSON.stringify(fileMetadata));
      
      // Read file as array buffer
      const buffer = await selectedFile.arrayBuffer();
      const chunkSize = 16384; // 16KB chunks
      
      // Send file in chunks
      for (let i = 0; i < buffer.byteLength; i += chunkSize) {
        if (dataChannel.readyState !== 'open') {
          throw new Error('Connection closed during file transfer');
        }
        
        const chunk = buffer.slice(i, Math.min(i + chunkSize, buffer.byteLength));
        dataChannel.send(chunk);
        
        const progress = Math.round((i / buffer.byteLength) * 100);
        if (progress % 5 === 0) { // Update progress every 5%
          setTransferProgress(progress);
          dataChannel.send(JSON.stringify({
            type: 'progress',
            progress: progress
          }));
        }
        
        // Small delay to prevent overwhelming the data channel
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      
      // Send end of file message
      dataChannel.send(JSON.stringify({
        type: 'file-end',
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        fileType: selectedFile.type
      }));
      
      setTransferProgress(100);
      setIsTransferring(false);
      
      toast({
        title: "File sent!",
        description: `${selectedFile.name} has been sent successfully`,
      });
    } catch (error) {
      console.error('Error sending file:', error);
      setIsTransferring(false);
      
      toast({
        title: "Transfer failed",
        description: "Failed to send file",
        variant: "destructive",
      });
    }
  };
  
  // Download received file
  const downloadFile = (file: FileData) => {
    if (!file.data) {
      toast({
        title: "File error",
        description: "No file data available",
        variant: "destructive",
      });
      return;
    }
    
    const blob = new Blob([file.data], { type: file.type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Download started",
      description: `Downloading ${file.name}`,
    });
  };
  
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header myId={myId} />
      
      <main className="flex-1 container mx-auto py-8 px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Sending Files Section */}
          <Card className="overflow-hidden shadow-lg">
            <CardHeader className="bg-primary/5">
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                Send Files
              </CardTitle>
            </CardHeader>
            
            <CardContent className="p-6">
              <FileUpload onFileSelect={handleFileSelect} selectedFile={selectedFile} />
              
              {selectedFile && (
                <div className="mt-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {selectedFile.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  
                  <div className="mt-4 space-y-4">
                    <Button 
                      onClick={generateShareLink}
                      className="w-full"
                      variant="outline"
                    >
                      Generate Connection Link
                    </Button>
                    
                    {shareableLink && (
                      <div className="mt-2">
                        <p className="text-sm font-medium mb-1">Share this link to connect:</p>
                        <div className="flex items-center gap-2">
                          <input 
                            type="text" 
                            value={shareableLink} 
                            readOnly 
                            className="flex-1 p-2 text-sm border rounded bg-muted"
                          />
                          <Button 
                            size="sm" 
                            onClick={() => {
                              navigator.clipboard.writeText(shareableLink);
                              toast({
                                title: "Link copied!",
                                description: "Share this link to allow others to connect",
                              });
                            }}
                          >
                            Copy
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {connection && (
                      <div className="mt-4">
                        <ConnectionStatus connection={connection} />
                        
                        {connection.status === 'connected' && (
                          <Button 
                            onClick={handleSendFile}
                            className="w-full mt-4"
                            disabled={isTransferring}
                          >
                            {isTransferring ? `Sending... ${transferProgress}%` : 'Send File'}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Receiving Files Section */}
          <Card className="overflow-hidden shadow-lg">
            <CardHeader className="bg-primary/5">
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Receive Files
              </CardTitle>
            </CardHeader>
            
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Connect to sender:</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      placeholder="Enter connection ID" 
                      value={connectionId}
                      onChange={(e) => setConnectionId(e.target.value)}
                      className="flex-1 p-2 text-sm border rounded"
                    />
                    <Button
                      onClick={() => handleConnect(connectionId)}
                      disabled={!connectionId || (connection?.status === 'connecting')}
                    >
                      Connect
                    </Button>
                  </div>
                </div>
                
                {connection && (
                  <div className="mt-4">
                    <ConnectionStatus connection={connection} />
                  </div>
                )}
                
                {isTransferring && (
                  <div className="mt-4">
                    <FileTransfer progress={transferProgress} />
                  </div>
                )}
                
                {receivedFiles.length > 0 && (
                  <div className="mt-6">
                    <h3 className="font-medium mb-3">Received Files:</h3>
                    <div className="space-y-3">
                      {receivedFiles.map((file) => (
                        <div key={file.id} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                {file.name}
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                            <Button 
                              size="sm"
                              variant="secondary"
                              onClick={() => downloadFile(file)}
                            >
                              Download
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Features Section */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-center mb-8">How It Works</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-background">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-bold mb-2">Secure Transfers</h3>
                  <p className="text-muted-foreground text-sm">
                    Files are transferred directly peer-to-peer with encryption.
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-background">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-bold mb-2">Lightning Fast</h3>
                  <p className="text-muted-foreground text-sm">
                    Direct peer-to-peer transfer without server bottlenecks.
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-background">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-bold mb-2">Any File Type</h3>
                  <p className="text-muted-foreground text-sm">
                    Share any type of file with ease.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
