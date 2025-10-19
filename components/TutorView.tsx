import React from 'react';
import ScreenDisplay from './ScreenDisplay';
import InstructionsPanel from './InstructionsPanel';

type ConversationMessage = {
  speaker: 'user' | 'tutor';
  text: string;
};

interface TutorViewProps {
  stream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  onStopSharing: () => void;
  conversation: ConversationMessage[];
  isListening: boolean;
  onToggleConversation: () => void;
  error: string | null;
}

const TutorView: React.FC<TutorViewProps> = (props) => {
  return (
    <div className="w-full h-screen flex flex-col lg:flex-row p-4 gap-4">
      <div className="flex-grow lg:w-2/3">
        <ScreenDisplay stream={props.stream} videoRef={props.videoRef} />
      </div>
      <div className="lg:w-1/3 h-full flex flex-col">
        <InstructionsPanel
          conversation={props.conversation}
          isListening={props.isListening}
          onToggleConversation={props.onToggleConversation}
          onStopSharing={props.onStopSharing}
          error={props.error}
        />
      </div>
    </div>
  );
};

export default TutorView;
