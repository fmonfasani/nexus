import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Grid, 
  Paper, 
  IconButton, 
  Typography, 
  Tooltip,
  Alert,
  Snackbar,
  Fab,
  Badge
} from '@mui/material';
import {
  Mic as MicIcon,
  MicOff as MicOffIcon,
  Videocam as VideocamIcon,
  VideocamOff as VideocamOffIcon,
  ScreenShare as ScreenShareIcon,
  StopScreenShare as StopScreenShareIcon,
  Chat as ChatIcon,
  People as PeopleIcon,
  CallEnd as CallEndIcon,
  Settings as SettingsIcon,
  MoreVert as MoreVertIcon,
  PanTool as HandIcon,
  FiberManualRecord as RecordIcon,
  Subtitles as SubtitlesIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

// Components
import VideoGrid from '@components/meeting/VideoGrid';
import ChatPanel from '@components/meeting/ChatPanel';
import ParticipantsPanel from '@components/meeting/ParticipantsPanel';
import TranscriptionPanel from '@components/meeting/TranscriptionPanel';
import MeetingSettings from '@components/meeting/MeetingSettings';
import ConnectionStatus from '@components/meeting/ConnectionStatus';
import LoadingSpinner from '@components/ui/LoadingSpinner';

// Hooks
import { useWebRTC } from '@hooks/useWebRTC';
import { useWebSocket } from '@hooks/useWebSocket';
import { useAuth } from '@hooks/useAuth';
import { useMeeting } from '@hooks/useMeeting';
import { useTranscription } from '@hooks/useTranscription';

// Types
import type { 
  Meeting, 
  Participant, 
  ChatMessage, 
  TranscriptionSegment,
  ConnectionQuality 
} from '@types/index';

// Utils
import { formatDuration, formatTime } from '@utils/dateUtils';
import { trackEvent } from '@utils/analytics';

// ===================================
// INTERFACES
// ===================================

interface MeetingControls {
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenSharing: boolean;
  handRaised: boolean;
  isRecording: boolean;
}

interface PanelState {
  chat: boolean;
  participants: boolean;
  transcription: boolean;
  settings: boolean;
}

// ===================================
// MAIN COMPONENT
// ===================================

const MeetingPage: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const meetingStartTimeRef = useRef<Date | null>(null);

  // State
  const [controls, setControls] = useState<MeetingControls>({
    audioEnabled: true,
    videoEnabled: true,
    screenSharing: false,
    handRaised: false,
    isRecording: false,
  });

  const [panels, setPanels] = useState<PanelState>({
    chat: false,
    participants: false,
    transcription: false,
    settings: false,
  });

  const [meetingDuration, setMeetingDuration] = useState<number>(0);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>({
    quality: 'good',
    latency: 0,
    bandwidth: { upload: 0, download: 0 },
    packetLoss: 0,
    jitter: 0,
  });

  const [showNotification, setShowNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  // Custom hooks
  const { 
    meeting, 
    participants, 
    isLoading: meetingLoading,
    error: meetingError,
    joinMeeting,
    leaveMeeting,
    updateParticipant,
  } = useMeeting(meetingId!);

  const { 
    isConnected,
    socket,
    joinMeetingRoom,
    leaveMeetingRoom,
    sendMessage,
  } = useWebSocket();

  const {
    localStream,
    remoteStreams,
    isConnecting,
    error: webrtcError,
    initializeWebRTC,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    cleanup: cleanupWebRTC,
  } = useWebRTC();

  const {
    transcriptionSegments,
    isTranscribing,
    startTranscription,
    stopTranscription,
  } = useTranscription(meetingId!);

  // ===================================
  // EFFECTS
  // ===================================

  // Initialize meeting
  useEffect(() => {
    if (meetingId && user) {
      initializeMeeting();
    }

    return () => {
      cleanup();
    };
  }, [meetingId, user]);

  // Update local video stream
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Meeting duration timer
  useEffect(() => {
    if (meeting?.status === 'ACTIVE' && !meetingStartTimeRef.current) {
      meetingStartTimeRef.current = meeting.startedAt ? new Date(meeting.startedAt) : new Date();
    }

    const interval = setInterval(() => {
      if (meetingStartTimeRef.current) {
        const now = new Date();
        const duration = Math.floor((now.getTime() - meetingStartTimeRef.current.getTime()) / 1000);
        setMeetingDuration(duration);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [meeting?.status]);

  // WebSocket event handlers
  useEffect(() => {
    if (!socket) return;

    socket.on('participant-joined', handleParticipantJoined);
    socket.on('participant-left', handleParticipantLeft);
    socket.on('participant-audio-toggle', handleParticipantAudioToggle);
    socket.on('participant-video-toggle', handleParticipantVideoToggle);
    socket.on('new-message', handleNewMessage);
    socket.on('transcription-segment', handleTranscriptionSegment);
    socket.on('meeting-ended', handleMeetingEnded);

    return () => {
      socket.off('participant-joined');
      socket.off('participant-left');
      socket.off('participant-audio-toggle');
      socket.off('participant-video-toggle');
      socket.off('new-message');
      socket.off('transcription-segment');
      socket.off('meeting-ended');
    };
  }, [socket]);

  // ===================================
  // HANDLERS
  // ===================================

  const initializeMeeting = async () => {
    try {
      // Join meeting via API
      await joinMeeting({
        name: user!.name,
        audioEnabled: controls.audioEnabled,
        videoEnabled: controls.videoEnabled,
      });

      // Initialize WebRTC
      await initializeWebRTC({
        audio: controls.audioEnabled,
        video: controls.videoEnabled,
      });

      // Join WebSocket room
      await joinMeetingRoom(meetingId!, {
        name: user!.name,
        audioEnabled: controls.audioEnabled,
        videoEnabled: controls.videoEnabled,
      });

      // Track analytics event
      trackEvent('meeting_joined', {
        meetingId: meetingId!,
        userId: user!.id,
        userRole: user!.role,
      });

      showNotification('success', 'Successfully joined the meeting');

    } catch (error) {
      console.error('Failed to initialize meeting:', error);
      showNotification('error', 'Failed to join the meeting');
      navigate('/dashboard');
    }
  };

  const cleanup = async () => {
    try {
      await leaveMeetingRoom();
      await leaveMeeting();
      await cleanupWebRTC();
      stopTranscription();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  };

  const handleLeaveMeeting = async () => {
    try {
      await cleanup();
      
      trackEvent('meeting_left', {
        meetingId: meetingId!,
        userId: user!.id,
        duration: meetingDuration,
      });

      navigate('/dashboard');
    } catch (error) {
      console.error('Error leaving meeting:', error);
      navigate('/dashboard');
    }
  };

  const handleToggleAudio = async () => {
    try {
      await toggleAudio();
      const newState = !controls.audioEnabled;
      
      setControls(prev => ({ ...prev, audioEnabled: newState }));
      
      // Notify other participants
      socket?.emit('toggle-audio', { enabled: newState });
      
      trackEvent('audio_toggled', {
        meetingId: meetingId!,
        enabled: newState,
      });

    } catch (error) {
      console.error('Error toggling audio:', error);
      showNotification('error', 'Failed to toggle audio');
    }
  };

  const handleToggleVideo = async () => {
    try {
      await toggleVideo();
      const newState = !controls.videoEnabled;
      
      setControls(prev => ({ ...prev, videoEnabled: newState }));
      
      // Notify other participants
      socket?.emit('toggle-video', { enabled: newState });
      
      trackEvent('video_toggled', {
        meetingId: meetingId!,
        enabled: newState,
      });

    } catch (error) {
      console.error('Error toggling video:', error);
      showNotification('error', 'Failed to toggle video');
    }
  };

  const handleToggleScreenShare = async () => {
    try {
      if (controls.screenSharing) {
        await stopScreenShare();
      } else {
        await startScreenShare();
      }
      
      const newState = !controls.screenSharing;
      setControls(prev => ({ ...prev, screenSharing: newState }));
      
      // Notify other participants
      socket?.emit('toggle-screen-share', { enabled: newState });
      
      trackEvent('screen_share_toggled', {
        meetingId: meetingId!,
        enabled: newState,
      });

    } catch (error) {
      console.error('Error toggling screen share:', error);
      showNotification('error', 'Failed to toggle screen share');
    }
  };

  const handleToggleHand = () => {
    const newState = !controls.handRaised;
    setControls(prev => ({ ...prev, handRaised: newState }));
    
    socket?.emit('toggle-hand', { raised: newState });
    
    showNotification('info', newState ? 'Hand raised' : 'Hand lowered');
  };

  const handleToggleRecording = () => {
    const newState = !controls.isRecording;
    setControls(prev => ({ ...prev, isRecording: newState }));
    
    if (newState) {
      socket?.emit('start-recording');
      showNotification('info', 'Recording started');
    } else {
      socket?.emit('stop-recording');
      showNotification('info', 'Recording stopped');
    }
    
    trackEvent('recording_toggled', {
      meetingId: meetingId!,
      enabled: newState,
    });
  };

  const handleToggleTranscription = () => {
    if (isTranscribing) {
      stopTranscription();
      showNotification('info', 'Transcription stopped');
    } else {
      startTranscription();
      showNotification('info', 'Transcription started');
    }
  };

  const togglePanel = (panel: keyof PanelState) => {
    setPanels(prev => ({
      ...prev,
      [panel]: !prev[panel],
    }));
  };

  // ===================================
  // WEBSOCKET EVENT HANDLERS
  // ===================================

  const handleParticipantJoined = (participant: Participant) => {
    showNotification('info', `${participant.name} joined the meeting`);
  };

  const handleParticipantLeft = (data: { participantId: string; userId: string }) => {
    const participant = participants.find(p => p.userId === data.userId);
    if (participant) {
      showNotification('info', `${participant.name} left the meeting`);
    }
  };

  const handleParticipantAudioToggle = (data: any) => {
    // Update participant audio state
    updateParticipant(data.userId, { audioEnabled: data.audioEnabled });
  };

  const handleParticipantVideoToggle = (data: any) => {
    // Update participant video state
    updateParticipant(data.userId, { videoEnabled: data.videoEnabled });
  };

  const handleNewMessage = (message: ChatMessage) => {
    // Chat messages are handled by ChatPanel component
    // This could trigger notifications for mentions
    if (message.mentions?.includes(user!.id)) {
      showNotification('info', `You were mentioned in chat by ${message.senderName}`);
    }
  };

  const handleTranscriptionSegment = (segment: TranscriptionSegment) => {
    // Transcription segments are handled by TranscriptionPanel
  };

  const handleMeetingEnded = () => {
    showNotification('info', 'Meeting has ended');
    setTimeout(() => {
      navigate('/dashboard');
    }, 3000);
  };

  // ===================================
  // UTILITY FUNCTIONS
  // ===================================

  const showNotification = (severity: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setShowNotification({
      open: true,
      message,
      severity,
    });
  };

  const closeNotification = () => {
    setShowNotification(prev => ({ ...prev, open: false }));
  };

  const getParticipantCount = () => {
    return participants.length;
  };

  const getChatUnreadCount = () => {
    // This would be implemented based on your chat state management
    return 0;
  };

  // ===================================
  // RENDER
  // ===================================

  if (meetingLoading || isConnecting) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        height="100vh"
        bgcolor="grey.900"
      >
        <LoadingSpinner message="Joining meeting..." />
      </Box>
    );
  }

  if (meetingError || webrtcError) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        height="100vh"
        bgcolor="grey.900"
      >
        <Alert severity="error" sx={{ maxWidth: 500 }}>
          <Typography variant="h6">Failed to join meeting</Typography>
          <Typography>{meetingError || webrtcError}</Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box 
      sx={{ 
        height: '100vh', 
        bgcolor: 'grey.900', 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <Box 
        sx={{ 
          p: 2, 
          bgcolor: 'grey.800', 
          display: 'flex', 
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 1000
        }}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="h6" color="white" noWrap>
            {meeting?.title || 'Meeting'}
          </Typography>
          <Typography variant="body2" color="grey.400">
            {formatDuration(meetingDuration)}
          </Typography>
          <ConnectionStatus quality={connectionQuality} />
        </Box>

        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="body2" color="grey.400">
            {getParticipantCount()} participant{getParticipantCount() !== 1 ? 's' : ''}
          </Typography>
          
          {controls.isRecording && (
            <Box display="flex" alignItems="center" gap={1}>
              <RecordIcon sx={{ color: 'error.main', fontSize: 16 }} />
              <Typography variant="body2" color="error.main">
                REC
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Video Area */}
        <Box sx={{ flex: 1, position: 'relative' }}>
          <VideoGrid
            localStream={localStream}
            remoteStreams={remoteStreams}
            participants={participants}
            localVideoRef={localVideoRef}
          />

          {/* Floating Action Buttons */}
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            <Tooltip title="Participants">
              <Fab
                size="small"
                onClick={() => togglePanel('participants')}
                sx={{ bgcolor: panels.participants ? 'primary.main' : 'grey.700' }}
              >
                <Badge badgeContent={getParticipantCount()} color="primary">
                  <PeopleIcon />
                </Badge>
              </Fab>
            </Tooltip>

            <Tooltip title="Chat">
              <Fab
                size="small"
                onClick={() => togglePanel('chat')}
                sx={{ bgcolor: panels.chat ? 'primary.main' : 'grey.700' }}
              >
                <Badge badgeContent={getChatUnreadCount()} color="error">
                  <ChatIcon />
                </Badge>
              </Fab>
            </Tooltip>

            <Tooltip title="Transcription">
              <Fab
                size="small"
                onClick={() => togglePanel('transcription')}
                sx={{ bgcolor: panels.transcription ? 'primary.main' : 'grey.700' }}
              >
                <SubtitlesIcon />
              </Fab>
            </Tooltip>
          </Box>
        </Box>

        {/* Side Panels */}
        <AnimatePresence>
          {(panels.chat || panels.participants || panels.transcription) && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{ overflow: 'hidden' }}
            >
              <Paper 
                sx={{ 
                  width: 320, 
                  height: '100%', 
                  bgcolor: 'grey.800',
                  borderRadius: 0,
                }}
              >
                {panels.chat && (
                  <ChatPanel 
                    meetingId={meetingId!}
                    onClose={() => togglePanel('chat')}
                  />
                )}
                
                {panels.participants && (
                  <ParticipantsPanel 
                    participants={participants}
                    currentUserId={user!.id}
                    onClose={() => togglePanel('participants')}
                  />
                )}
                
                {panels.transcription && (
                  <TranscriptionPanel 
                    segments={transcriptionSegments}
                    isTranscribing={isTranscribing}
                    onToggleTranscription={handleToggleTranscription}
                    onClose={() => togglePanel('transcription')}
                  />
                )}
              </Paper>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>

      {/* Bottom Controls */}
      <Box 
        sx={{ 
          p: 2, 
          bgcolor: 'grey.800', 
          display: 'flex', 
          justifyContent: 'center',
          alignItems: 'center',
          gap: 2,
          zIndex: 1000
        }}
      >
        {/* Audio Control */}
        <Tooltip title={controls.audioEnabled ? 'Mute' : 'Unmute'}>
          <IconButton
            onClick={handleToggleAudio}
            sx={{
              bgcolor: controls.audioEnabled ? 'grey.700' : 'error.main',
              color: 'white',
              '&:hover': {
                bgcolor: controls.audioEnabled ? 'grey.600' : 'error.dark',
              },
            }}
          >
            {controls.audioEnabled ? <MicIcon /> : <MicOffIcon />}
          </IconButton>
        </Tooltip>

        {/* Video Control */}
        <Tooltip title={controls.videoEnabled ? 'Turn off camera' : 'Turn on camera'}>
          <IconButton
            onClick={handleToggleVideo}
            sx={{
              bgcolor: controls.videoEnabled ? 'grey.700' : 'error.main',
              color: 'white',
              '&:hover': {
                bgcolor: controls.videoEnabled ? 'grey.600' : 'error.dark',
              },
            }}
          >
            {controls.videoEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
          </IconButton>
        </Tooltip>

        {/* Screen Share Control */}
        <Tooltip title={controls.screenSharing ? 'Stop sharing' : 'Share screen'}>
          <IconButton
            onClick={handleToggleScreenShare}
            sx={{
              bgcolor: controls.screenSharing ? 'primary.main' : 'grey.700',
              color: 'white',
              '&:hover': {
                bgcolor: controls.screenSharing ? 'primary.dark' : 'grey.600',
              },
            }}
          >
            {controls.screenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
          </IconButton>
        </Tooltip>

        {/* Hand Raise Control */}
        <Tooltip title={controls.handRaised ? 'Lower hand' : 'Raise hand'}>
          <IconButton
            onClick={handleToggleHand}
            sx={{
              bgcolor: controls.handRaised ? 'warning.main' : 'grey.700',
              color: 'white',
              '&:hover': {
                bgcolor: controls.handRaised ? 'warning.dark' : 'grey.600',
              },
            }}
          >
            <HandIcon />
          </IconButton>
        </Tooltip>

        {/* Recording Control (Host only) */}
        {user?.role === 'host' && (
          <Tooltip title={controls.isRecording ? 'Stop recording' : 'Start recording'}>
            <IconButton
              onClick={handleToggleRecording}
              sx={{
                bgcolor: controls.isRecording ? 'error.main' : 'grey.700',
                color: 'white',
                '&:hover': {
                  bgcolor: controls.isRecording ? 'error.dark' : 'grey.600',
                },
              }}
            >
              <RecordIcon />
            </IconButton>
          </Tooltip>
        )}

        {/* Settings */}
        <Tooltip title="Settings">
          <IconButton
            onClick={() => togglePanel('settings')}
            sx={{
              bgcolor: 'grey.700',
              color: 'white',
              '&:hover': { bgcolor: 'grey.600' },
            }}
          >
            <SettingsIcon />
          </IconButton>
        </Tooltip>

        {/* Leave Meeting */}
        <Tooltip title="Leave meeting">
          <IconButton
            onClick={handleLeaveMeeting}
            sx={{
              bgcolor: 'error.main',
              color: 'white',
              '&:hover': { bgcolor: 'error.dark' },
              ml: 2,
            }}
          >
            <CallEndIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Settings Panel */}
      {panels.settings && (
        <MeetingSettings
          open={panels.settings}
          onClose={() => togglePanel('settings')}
          meeting={meeting}
          controls={controls}
          onControlsChange={setControls}
        />
      )}

      {/* Notifications */}
      <Snackbar
        open={showNotification.open}
        autoHideDuration={4000}
        onClose={closeNotification}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={closeNotification} 
          severity={showNotification.severity}
          sx={{ width: '100%' }}
        >
          {showNotification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MeetingPage;