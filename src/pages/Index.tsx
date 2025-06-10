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
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:10000';

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
  const [pendingRequest, setPendingRequest] = useState<{sessionId: string, receiverId: string} | null>(null);
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
    console.log('Attempting to connect to socket server at:', SOCKET_URL);
    
    // Handle connection events
    socketRef.current.on('connect', () => {
      console.log('Socket connected with ID:', socketRef.current?.id);
      setMyId(socketRef.current?.id || '');
    });
    
    // Socket connection error handling
    socketRef.current.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to server. Please try again.",
        variant: "destructive",
      });
    });
    
    // Handle session created confirmation
    socketRef.current.on('session-created', (data) => {
      console.log('Session created confirmation received:', data);
      toast({
        title: "Session Created",
        description: "Share the link with others to send your file",
      });
    });
    
    // Handle session join errors
    socketRef.current.on('session-join-error', (data) => {
      console.error('Session join error:', data.error);
      toast({
        title: "Join Error",
        description: data.error,
        variant: "destructive",
      });
    });
    
    // Handle offer from peer
    socketRef.current.on('offer', async (data) => {
      console.log('RECEIVER: Received offer from:', data.senderId);
      
      // Clean up any existing connections
      cleanupPeerConnection();
      
      // Create a simple configuration that matches the sender
      const simpleConfig = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };
      
      // Create new peer connection
      const peer = new RTCPeerConnection(simpleConfig);
      peerRef.current = peer;
      
      // Log all state changes for debugging
      peer.oniceconnectionstatechange = () => {
        console.log('ICE connection state changed:', peer.iceConnectionState);
      };
      
      peer.onconnectionstatechange = () => {
        console.log('Connection state changed:', peer.connectionState);
        if (peer.connectionState === 'connected') {
          setConnection(prev => prev ? { ...prev, status: 'connected' } : null);
        }
      };
      
      // Handle ICE candidates
      peer.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          console.log('RECEIVER: Generated ICE candidate');
          socketRef.current.emit('ice-candidate', {
            targetId: data.senderId,
            senderId: myId,
            candidate: event.candidate
          });
        }
      };
      
      // Handle data channel creation
      peer.ondatachannel = (event) => {
        console.log('RECEIVER: Received data channel:', event.channel.label);
        setupDataChannel(event.channel);
      };
      
      try {
        // Set the remote description first
        console.log('RECEIVER: Setting remote description from offer');
        await peer.setRemoteDescription(new RTCSessionDescription(data.offer));
        
        // Create and set the answer
        console.log('RECEIVER: Creating answer');
        const answer = await peer.createAnswer();
        console.log('RECEIVER: Setting local description');
        await peer.setLocalDescription(answer);
        
        // Send the answer after a short delay to ensure ICE candidates are gathered
        setTimeout(() => {
          if (socketRef.current) {
            console.log('RECEIVER: Sending answer to:', data.senderId);
            socketRef.current.emit('answer', {
              targetId: data.senderId,
              senderId: myId,
              answer: peer.localDescription
            });
          }
        }, 1000);
        
        // Update connection status
        setConnection({
          id: data.senderId,
          status: 'connecting',
          peer: peer
        });
        
        toast({
          title: "Connection request",
          description: `User ${data.senderId} wants to send you a file`,
        });
      } catch (error) {
        console.error('RECEIVER: Error handling offer:', error);
        toast({
          title: "Connection failed",
          description: "Failed to establish connection",
          variant: "destructive",
        });
      }
    });
    
    // Handle answer from peer
    socketRef.current.on('answer', async (data) => {
      console.log('SENDER: Received answer from:', data.senderId);
      
      if (!peerRef.current) {
        console.error('No peer connection available to process answer');
        return;
      }
      
      try {
        console.log('SENDER: Setting remote description from answer');
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        console.log('SENDER: Set remote description success');
      } catch (error) {
        console.error('SENDER: Error handling answer:', error);
      }
    });
    
    // Handle ICE candidate from peer
    socketRef.current.on('ice-candidate', async (data) => {
      console.log('Received ICE candidate from:', data.senderId);
      
      if (!peerRef.current) {
        console.error('No peer connection available to add ICE candidate');
        return;
      }
      
      try {
        // Check connection state and add candidate if appropriate
        if (peerRef.current.remoteDescription) {
          console.log('Adding ICE candidate');
          await peerRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          console.log('Successfully added ICE candidate');
        } else {
          console.log('Skipping ICE candidate - no remote description yet');
        }
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    });
    
    // Handle file sharing request from someone who joined the session
    socketRef.current.on('share-request', (data) => {
      console.log('Received share request from:', data.receiverId, 'for session:', data.sessionId);
      
      // Set the pending request in state to show the UI
      setPendingRequest({
        sessionId: data.sessionId,
        receiverId: data.receiverId
      });
      
      // Play sound to alert user (if browser supports it)
      try {
        const audio = new Audio('/notification.mp3');
        audio.play().catch(e => console.log('Audio play failed:', e));
      } catch (e) {
        console.log('Audio not supported');
      }
      
      // Show a toast notification
      toast({
        title: "File Request",
        description: "Someone wants to receive your file. Please accept or reject.",
      });
    });
    
    // Handle waiting for approval state
    socketRef.current.on('waiting-for-approval', (data) => {
      console.log('Waiting for sender approval, session:', data.sessionId);
      console.log('File info:', data.fileInfo);
      
      // Update connection status to show waiting state
      setConnection({
        id: 'pending',
        status: 'connecting'
      });
      
      toast({
        title: "Waiting for approval",
        description: "The file sender needs to accept your request",
      });
    });
    
    // Handle successful connection establishment after approval
    socketRef.current.on('connection-established', (data) => {
      console.log('Connection established for session:', data.sessionId, 'as', data.role);
      
      toast({
        title: "Connection established",
        description: `You are now connected as ${data.role}`,
      });
      
      // Use simplified WebRTC approach
      if (data.role === 'sender') {
        console.log('SENDER: Starting simplified WebRTC connection to:', data.peerSocketId);
        
        // Clean up any existing connections
        cleanupPeerConnection();
        
        // Create a very simple configuration with public STUN servers
        const simpleConfig = {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        };
        
        // Create new peer connection
        const peer = new RTCPeerConnection(simpleConfig);
        peerRef.current = peer;
        
        // Create data channel first (before offer)
        try {
          console.log('SENDER: Creating data channel');
          const dataChannel = peer.createDataChannel('fileTransfer', {
            ordered: true
          });
          setupDataChannel(dataChannel);
        } catch (err) {
          console.error('Error creating data channel:', err);
        }
        
        // Log all state changes for debugging
        peer.oniceconnectionstatechange = () => {
          console.log('ICE connection state changed:', peer.iceConnectionState);
        };
        
        peer.onconnectionstatechange = () => {
          console.log('Connection state changed:', peer.connectionState);
          if (peer.connectionState === 'connected') {
            setConnection({
              id: data.peerSocketId,
              status: 'connected',
              peer: peer
            });
          }
        };
        
        // Handle ICE candidates
        peer.onicecandidate = (event) => {
          if (event.candidate && socketRef.current) {
            console.log('SENDER: Generated ICE candidate');
            socketRef.current.emit('ice-candidate', {
              targetId: data.peerSocketId,
              senderId: myId,
              candidate: event.candidate
            });
          }
        };
        
        // Create and send offer
        peer.createOffer()
          .then(offer => {
            console.log('SENDER: Created offer, setting local description');
            return peer.setLocalDescription(offer);
          })
          .then(() => {
            // Wait a bit for ICE gathering
            setTimeout(() => {
              if (socketRef.current) {
                console.log('SENDER: Sending offer to receiver');
                socketRef.current.emit('offer', {
                  targetId: data.peerSocketId,
                  senderId: myId,
                  offer: peer.localDescription
                });
              }
            }, 1000);
          })
          .catch(err => {
            console.error('Error creating/sending offer:', err);
          });
        
        // Update UI
        setConnection({
          id: data.peerSocketId,
          status: 'connecting',
          peer: peer
        });
      } else { // Receiver side
        console.log('RECEIVER: Waiting for offer from sender:', data.peerSocketId);
        
        // Just update status and wait for offer
        setConnection({
          id: data.peerSocketId,
          status: 'connecting'
        });
      }
    });
    
    // Handle declined share request
    socketRef.current.on('share-declined', (data) => {
      console.log('Share request declined for session:', data.sessionId);
      
      toast({
        title: "Request declined",
        description: "The file sender declined your request",
        variant: "destructive",
      });
      
      setConnection(null);
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
    const sessionId = urlParams.get('session');
    
    if (sessionId && socketRef.current?.connected && myId) {
      console.log('Session ID detected in URL:', sessionId);
      // Join the file sharing session
      socketRef.current.emit('join-session', { sessionId });
      
      // Show toast notification for user
      toast({
        title: "Joining session",
        description: "Requesting access to the shared file...",
      });
      return;
    }
    
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
    
    console.log('Initializing new WebRTC peer connection');
    
    // Use more STUN and TURN servers for better connectivity
    const enhancedConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        // Public TURN servers (for testing only)
        {
          urls: 'turn:global.turn.twilio.com:3478?transport=udp',
          username: 'f4b4035eaa76f4a55de5f4351567653ee4ff6fa97b50b6b334fcc1be9c27212d',
          credential: 'w1WpauEsFYlymHFJevRPcxmHHWdnkQFmzOvpNL1e4SQ='
        }
      ],
      iceCandidatePoolSize: 10
    };
    
    const peer = new RTCPeerConnection(enhancedConfig);
    peerRef.current = peer;
    
    // Handle ICE candidates
    peer.onicecandidate = (event) => {
      if (event.candidate && socketRef.current && connection) {
        console.log('Generated ICE candidate:', event.candidate.candidate);
        
        const targetId = connection.id;
        console.log('Sending ICE candidate to:', targetId);
        
        socketRef.current.emit('ice-candidate', {
          targetId: targetId,
          senderId: myId,
          candidate: event.candidate
        });
      } else if (!event.candidate) {
        console.log('ICE candidate gathering complete');
      }
    };
    
    // Handle ICE connection state changes
    peer.oniceconnectionstatechange = () => {
      console.log('ICE connection state changed:', peer.iceConnectionState);
      
      if (peer.iceConnectionState === 'connected' || peer.iceConnectionState === 'completed') {
        console.log('ICE connection established successfully');
        
        // Ensure connection state reflects this
        setConnection(prev => prev ? { ...prev, status: 'connected' } : null);
      } else if (peer.iceConnectionState === 'failed') {
        console.log('ICE connection failed, attempting restart');
        
        // Try to restart ICE if it failed
        try {
          peer.restartIce();
          toast({
            title: "Connection issue",
            description: "Attempting to reconnect...",
          });
        } catch (error) {
          console.error('Failed to restart ICE:', error);
        }
      } else if (peer.iceConnectionState === 'disconnected') {
        console.log('ICE connection disconnected');
        toast({
          title: "Connection interrupted",
          description: "The connection was interrupted. Trying to reconnect...",
          variant: "destructive",
        });
      }
    };
    
    // Use direct signaling for better reliability
    peer.onnegotiationneeded = async () => {
      console.log('Negotiation needed - creating new offer');
      
      if (!connection) {
        console.log('No connection info, cannot negotiate');
        return;
      }
      
      try {
        const offer = await peer.createOffer({
          offerToReceiveAudio: false,
          offerToReceiveVideo: false
        });
        
        await peer.setLocalDescription(offer);
        
        // Wait for ICE gathering to complete or timeout
        await new Promise<void>((resolve) => {
          const checkState = () => {
            if (peer.iceGatheringState === 'complete') {
              resolve();
            } else {
              setTimeout(checkState, 500);
            }
          };
          
          // Start checking and set a timeout
          checkState();
          setTimeout(resolve, 5000); // 5 second timeout
        });
        
        // Send direct signal with complete offer
        if (socketRef.current && peer.localDescription) {
          socketRef.current.emit('direct-signal', {
            targetId: connection.id,
            type: 'offer',
            sdp: peer.localDescription
          });
          console.log('Sent direct offer signal to:', connection.id);
        }
      } catch (error) {
        console.error('Error creating offer:', error);
      }
    };
    
    // Listen for direct signals
    socketRef.current?.on('direct-signal', async (data) => {
      console.log('Received direct signal:', data.type, 'from:', data.senderId);
      
      try {
        if (data.type === 'offer') {
          await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          
          // Send answer back
          socketRef.current?.emit('direct-signal', {
            targetId: data.senderId,
            type: 'answer',
            sdp: peer.localDescription
          });
          console.log('Sent direct answer signal to:', data.senderId);
        } else if (data.type === 'answer') {
          await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
          console.log('Set remote description from direct answer');
        }
      } catch (error) {
        console.error('Error handling direct signal:', error);
      }
    });
    
    // Handle connection state changes
    peer.onconnectionstatechange = () => {
      console.log('Connection state changed:', peer.connectionState);
      
      if (peer.connectionState === 'connected') {
        console.log('WebRTC connection fully established');
        setConnection(prev => prev ? { ...prev, status: 'connected' } : null);
        
        toast({
          title: "Connected",
          description: "File transfer connection established",
        });
        
        // Force create data channel if not already created
        if (!dataChannelRef.current) {
          try {
            const dataChannel = peer.createDataChannel('fileTransfer', {
              ordered: true
            });
            setupDataChannel(dataChannel);
            console.log('Created data channel after connection established');
          } catch (error) {
            console.error('Error creating data channel after connection:', error);
          }
        }
      } else if (peer.connectionState === 'disconnected' || peer.connectionState === 'failed') {
        console.log('WebRTC connection failed or disconnected');
        setConnection(prev => prev ? { ...prev, status: 'disconnected' } : null);
        
        toast({
          title: "Connection lost",
          description: "The file transfer connection was lost",
          variant: "destructive",
        });
      }
    };
    
    // Handle data channel (for receiver)
    peer.ondatachannel = (event) => {
      console.log('Data channel received:', event.channel.label);
      setupDataChannel(event.channel);
    };
    
    return peer;
  };
  
  // Setup data channel for file transfer
  const setupDataChannel = (channel: RTCDataChannel) => {
    dataChannelRef.current = channel;
    
    console.log('Setting up data channel with state:', channel.readyState);
    
    // Reset chunks when new connection is established
    fileChunksRef.current = [];
    
    channel.binaryType = 'arraybuffer';
    
    // Configure channel for optimal file transfer
    if ('maxRetransmits' in channel) {
      console.log('Channel parameters:', {
        ordered: channel.ordered,
        maxRetransmits: channel.maxRetransmits || 'not supported'
      });
      // RTCDataChannel properties are read-only after creation
      // These settings should be configured when creating the channel instead
    }
    
    channel.onopen = () => {
      console.log('Data channel opened successfully');
      // Update UI to show channel is ready
      toast({
        title: "Channel ready",
        description: "File transfer channel is now ready",
      });
      
      // Make sure connection state is updated
      setConnection(prev => prev ? { ...prev, status: 'connected' } : null);
    };
    
    channel.onclose = () => {
      console.log('Data channel closed');
      toast({
        title: "Channel closed",
        description: "File transfer channel has closed",
        variant: "destructive",
      });
    };
    
    channel.onerror = (error) => {
      console.error('Data channel error:', error);
      toast({
        title: "Connection error",
        description: "There was a problem with the file transfer connection",
        variant: "destructive",
      });
    };
    
    // Add a polling check to monitor data channel state changes
    const checkChannelState = () => {
      if (dataChannelRef.current) {
        console.log('Data channel state:', dataChannelRef.current.readyState);
        if (dataChannelRef.current.readyState === 'open') {
          console.log('Data channel is now open and ready for transfer');
          // Send a ping to verify the channel is truly working
          try {
            dataChannelRef.current.send(JSON.stringify({
              type: 'ping',
              timestamp: Date.now()
            }));
            console.log('Sent ping on data channel');
          } catch (error) {
            console.error('Failed to send ping:', error);
          }
        } else if (dataChannelRef.current.readyState === 'connecting') {
          // Keep checking if it's still connecting
          setTimeout(checkChannelState, 1000);
        } else if (dataChannelRef.current.readyState === 'closed') {
          console.log('Data channel is closed - attempting to recreate');
          // Try to recreate the channel if possible
          if (peerRef.current && peerRef.current.connectionState === 'connected') {
            try {
              const newChannel = peerRef.current.createDataChannel('fileTransfer', {
                ordered: true,
                maxRetransmits: 30 // Allow up to 30 retransmissions
              });
              setupDataChannel(newChannel);
              console.log('Created new data channel after previous one closed');
            } catch (error) {
              console.error('Failed to recreate data channel:', error);
            }
          }
        }
      }
    };
    
    // Start polling after a short delay
    setTimeout(checkChannelState, 1000);
    
    channel.onmessage = (event) => {
      const data = event.data;
      
      // Check if the message is JSON (metadata) or binary (file chunk)
      if (typeof data === 'string') {
        try {
          const message = JSON.parse(data);
          
          // Handle ping/pong for channel verification
          if (message.type === 'ping') {
            console.log('Received ping, sending pong');
            channel.send(JSON.stringify({
              type: 'pong',
              timestamp: message.timestamp,
              receivedAt: Date.now()
            }));
            return;
          } else if (message.type === 'pong') {
            const latency = Date.now() - message.timestamp;
            console.log(`Channel verified working with ${latency}ms latency`);
            return;
          }
          
          // Handle different message types
          if (message.type === 'file-start') {
            console.log('Receiving file transfer started:', message.fileName);
            fileChunksRef.current = []; // Reset chunks for new file
            setIsTransferring(true);
            setTransferProgress(0);
            toast({
              title: "File transfer started",
              description: `Receiving file: ${message.fileName}`,
            });
          } else if (message.type === 'file-end') {
            console.log('File transfer completed. Processing file...');
            try {
              // Combine all chunks and create file
              const combinedBuffer = concatenateArrayBuffers(fileChunksRef.current);
              console.log(`Received complete file: ${message.fileName}, size: ${combinedBuffer.byteLength} bytes`);
              
              if (combinedBuffer.byteLength === 0) {
                throw new Error('Received empty file data');
              }
              
              const fileData: FileData = {
                id: message.fileId || Math.random().toString(36).substring(2, 15),
                name: message.fileName,
                size: message.fileSize,
                type: message.fileType,
                data: combinedBuffer
              };
              
              // Add to received files
              setReceivedFiles(prevFiles => {
                const newFiles = [...prevFiles, fileData];
                console.log(`Updated received files array, now contains ${newFiles.length} files`);
                return newFiles;
              });
              
              // Force a render update
              setTimeout(() => {
                setIsTransferring(false);
                setTransferProgress(100);
              }, 100);
              
              toast({
                title: "File received!",
                description: `${message.fileName} has been received successfully. Click download to save it.`,
                action: (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadFile(fileData)}
                  >
                    Download Now
                  </Button>
                ),
              });
              
              console.log('File added to received files list:', fileData.id);
            } catch (error) {
              console.error('Error processing received file:', error);
              toast({
                title: "File processing error",
                description: "There was a problem processing the received file.",
                variant: "destructive",
              });
            }
          } else if (message.type === 'progress') {
            setTransferProgress(message.progress);
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      } else if (data instanceof ArrayBuffer) {
        // Handle file chunk
        console.log(`Received file chunk: ${data.byteLength} bytes`);
        fileChunksRef.current.push(new Uint8Array(data));
      } else {
        console.log('Received unknown data type:', typeof data);
      }
    };
  };
  
  // Combine array buffers into one
  const concatenateArrayBuffers = (arrays: Uint8Array[]) => {
    console.log(`Concatenating ${arrays.length} chunks`);
    if (arrays.length === 0) {
      console.error('No chunks to concatenate');
      return new ArrayBuffer(0);
    }
    
    try {
      const totalLength = arrays.reduce((acc, value) => acc + value.length, 0);
      console.log(`Total length of all chunks: ${totalLength} bytes`);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const array of arrays) {
        result.set(array, offset);
        offset += array.length;
      }
      
      console.log(`Successfully concatenated chunks into a buffer of ${result.buffer.byteLength} bytes`);
      return result.buffer;
    } catch (error) {
      console.error('Error concatenating array buffers:', error);
      // Return empty buffer as fallback
      return new ArrayBuffer(0);
    }
  };
  
  // Cleanup peer connection
  const cleanupPeerConnection = () => {
    console.log('Cleaning up peer connection');
    
    if (dataChannelRef.current) {
      console.log('Closing data channel');
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    
    if (peerRef.current) {
      console.log('Closing peer connection');
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
  
  // Accept file sharing request
  const acceptFileRequest = () => {
    if (pendingRequest && socketRef.current) {
      socketRef.current.emit('share-response', {
        sessionId: pendingRequest.sessionId,
        accepted: true
      });
      
      toast({
        title: "Request accepted",
        description: "File sharing connection established",
      });
      
      // Clear the pending request
      setPendingRequest(null);
    }
  };
  
  // Reject file sharing request
  const rejectFileRequest = () => {
    if (pendingRequest && socketRef.current) {
      socketRef.current.emit('share-response', {
        sessionId: pendingRequest.sessionId,
        accepted: false
      });
      
      toast({
        title: "Request rejected",
        description: "File sharing request was rejected",
      });
      
      // Clear the pending request
      setPendingRequest(null);
    }
  };
  
  // Generate shareable link with connection ID
  const generateShareLink = () => {
    if (!selectedFile || !socketRef.current) {
      toast({
        title: "Error",
        description: "Please select a file first",
        variant: "destructive",
      });
      return;
    }
    
    // Create a session for file sharing
    const sessionId = Math.random().toString(36).substring(2, 15);
    const fileInfo = {
      name: selectedFile.name,
      size: selectedFile.size,
      type: selectedFile.type
    };
    
    console.log('Creating file sharing session:', sessionId, 'with file:', fileInfo);
    socketRef.current.emit('create-session', {
      sessionId,
      fileInfo
    });
    
    // Create shareable link with session ID
    const url = new URL(window.location.href);
    url.searchParams.set('session', sessionId);
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
    if (!targetId.trim()) {
      toast({
        title: "Invalid ID",
        description: "Please enter a valid connection ID",
        variant: "destructive",
      });
      return;
    }
    
    if (targetId === myId) {
      toast({
        title: "Invalid ID",
        description: "You cannot connect to yourself",
        variant: "destructive",
      });
      return;
    }
    
    // Check if this is a session ID
    if (targetId.length === 13) { // Session IDs are 13 characters
      console.log('Attempting to join session:', targetId);
      if (socketRef.current) {
        socketRef.current.emit('join-session', { sessionId: targetId });
        toast({
          title: "Joining session",
          description: "Requesting access to the shared file...",
        });
      }
      return;
    }
    
    console.log('Attempting direct WebRTC connection to:', targetId);
    setConnection({
      id: targetId,
      status: 'connecting'
    });
    
    // Otherwise, proceed with WebRTC direct connection
    try {
      const peer = initializePeerConnection();
      
      // Create data channel for file transfer
      const dataChannel = peer.createDataChannel('fileTransfer', {
        ordered: true,
        maxRetransmits: 30 // Configure reliability parameters at creation time
      });
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
  
  // Add a function to retry connection
  const retryConnection = () => {
    console.log('Retrying WebRTC connection...');
    
    if (!connection) {
      console.log('No connection information available for retry');
      return;
    }
    
    const targetId = connection.id;
    
    // Initialize a new peer connection
    const peer = initializePeerConnection();
    
    // Create a new data channel
    try {
      const dataChannel = peer.createDataChannel('fileTransfer', {
        ordered: true
      });
      setupDataChannel(dataChannel);
      console.log('Created new data channel for retry');
      
      // Create and send a new offer
      peer.createOffer()
        .then(offer => {
          return peer.setLocalDescription(offer);
        })
        .then(() => {
          if (socketRef.current) {
            socketRef.current.emit('offer', {
              targetId: targetId,
              senderId: myId,
              offer: peer.localDescription
            });
            console.log('Sent new WebRTC offer to:', targetId);
            
            toast({
              title: "Reconnecting",
              description: "Attempting to reestablish connection...",
            });
          }
        })
        .catch(error => {
          console.error('Error during connection retry:', error);
        });
      
      // Update connection object with new peer
      setConnection(prev => prev ? { ...prev, peer: peer } : null);
    } catch (error) {
      console.error('Failed to retry connection:', error);
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
    
    console.log('Current connection state:', connection);
    console.log('Data channel state:', dataChannelRef.current?.readyState);
    
    if (!connection || connection.status !== 'connected') {
      toast({
        title: "Not connected",
        description: "Please connect to a peer first",
        variant: "destructive",
      });
      return;
    }
    
    if (!dataChannelRef.current) {
      toast({
        title: "Connection error",
        description: "WebRTC data channel not established. Attempting to reconnect...",
        variant: "destructive",
      });
      
      // Attempt to reconnect
      retryConnection();
      return;
    }
    
    const dataChannel = dataChannelRef.current;
    if (dataChannel.readyState !== 'open') {
      toast({
        title: "Channel not open",
        description: `The connection is not ready (state: ${dataChannel.readyState}). Attempting to reconnect...`,
        variant: "destructive",
      });
      
      // If the channel exists but isn't open, try to reconnect
      retryConnection();
      return;
    }
    
    setIsTransferring(true);
    setTransferProgress(0);
    
    try {
      // First, verify the channel is working with a ping
      dataChannel.send(JSON.stringify({
        type: 'ping',
        timestamp: Date.now()
      }));
      
      // Wait a bit to confirm channel is stable
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Send file metadata
      const fileId = Math.random().toString(36).substring(2, 15);
      const fileMetadata = {
        type: 'file-start',
        fileId,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        fileType: selectedFile.type
      };
      
      console.log('Sending file metadata:', fileMetadata);
      dataChannel.send(JSON.stringify(fileMetadata));
      
      // Read file as array buffer
      const buffer = await selectedFile.arrayBuffer();
      
      // Use smaller chunks for better reliability
      const chunkSize = 16 * 1024; // 16KB chunks
      const totalChunks = Math.ceil(buffer.byteLength / chunkSize);
      console.log(`Sending file in ${totalChunks} chunks of ${chunkSize} bytes each`);
      
      // Send file in chunks with controlled pacing
      let sentChunks = 0;
      
      for (let i = 0; i < buffer.byteLength; i += chunkSize) {
        // Check if connection is still open
        if (dataChannel.readyState !== 'open') {
          throw new Error('Connection closed during file transfer');
        }
        
        // Get the next chunk
        const chunk = buffer.slice(i, Math.min(i + chunkSize, buffer.byteLength));
        
        // Use a promise to track when it's safe to send the next chunk
        await new Promise<void>((resolve, reject) => {
          try {
            // Send the chunk
            dataChannel.send(chunk);
            sentChunks++;
            
            // Calculate progress
            const progress = Math.round((sentChunks / totalChunks) * 100);
            if (progress % 5 === 0 || sentChunks === totalChunks) { // Update progress every 5% and at the end
              setTransferProgress(progress);
              dataChannel.send(JSON.stringify({
                type: 'progress',
                progress: progress
              }));
            }
            
            // Introduce a small delay between chunks to prevent overwhelming the connection
            setTimeout(resolve, 5);
          } catch (error) {
            console.error('Error sending chunk:', error);
            reject(error);
          }
        });
      }
      
      // Send end of file message
      console.log('File chunks sent, sending end marker');
      dataChannel.send(JSON.stringify({
        type: 'file-end',
        fileId,
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
        description: `Failed to send file: ${error.message}`,
        variant: "destructive",
      });
    }
  };
  
  // Download received file
  const downloadFile = (file: FileData) => {
    console.log('Downloading file:', file.name);
    if (!file.data) {
      console.error('File data is missing for:', file.name);
      toast({
        title: "File error",
        description: "No file data available for download",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const blob = new Blob([file.data], { type: file.type || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('File download initiated:', file.name);
      toast({
        title: "Download started",
        description: `Downloading ${file.name}`,
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Download failed",
        description: `Failed to download file: ${error.message}`,
        variant: "destructive",
      });
    }
  };
  
  useEffect(() => {
    // Check for URL params
    const urlParams = new URLSearchParams(window.location.search);
    const sessionParam = urlParams.get('session');
    
    if (sessionParam) {
      setConnectionId(sessionParam);
      
      // Auto-connect after a short delay (to ensure socket is ready)
      setTimeout(() => {
        handleConnect(sessionParam);
      }, 1000);
    }
    
    // Cleanup function
    return () => {
      cleanupPeerConnection();
      socketRef.current?.disconnect();
    };
  }, []);
  
  // Add another useEffect to log whenever receivedFiles changes
  useEffect(() => {
    if (receivedFiles.length > 0) {
      console.log(`Received files list updated, now has ${receivedFiles.length} files`);
      receivedFiles.forEach((file, index) => {
        console.log(`File ${index + 1}: ${file.name}, ${file.size} bytes, has data: ${Boolean(file.data)}`);
      });
    }
  }, [receivedFiles]);
  
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header myId={myId} />
      
      {/* File Request Dialog */}
      {pendingRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">File Request</h3>
            <p className="mb-6">Someone wants to receive your file. Do you want to accept?</p>
            
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={rejectFileRequest}
              >
                Reject
              </Button>
              <Button 
                onClick={acceptFileRequest}
              >
                Accept
              </Button>
            </div>
          </div>
        </div>
      )}
      
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
                
                {receivedFiles.length > 0 ? (
                  <div className="mt-6">
                    <h3 className="font-medium mb-3">Received Files ({receivedFiles.length}):</h3>
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
                              <p className="text-xs text-muted-foreground mt-1">
                                {file.data ? `${file.data.byteLength} bytes available` : 'No data available'}
                              </p>
                            </div>
                            <Button 
                              size="sm"
                              variant="secondary"
                              onClick={() => downloadFile(file)}
                              className="bg-primary text-primary-foreground hover:bg-primary/90"
                              disabled={!file.data}
                            >
                              <Download className="h-4 w-4 mr-1" /> Download
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  connection && connection.status === 'connected' && (
                    <div className="mt-6 p-4 border rounded-lg bg-muted/30 text-center">
                      <p className="text-muted-foreground">Connected and ready to receive files</p>
                    </div>
                  )
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
