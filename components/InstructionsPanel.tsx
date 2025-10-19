import React, { useRef, useEffect } from 'react';
import { MicrophoneIcon, MicrophoneOffIcon, StopCircleIcon } from './icons';

type ConversationMessage = {
  speaker: 'user' | 'tutor';
  text: string;
};

interface InstructionsPanelProps {
  conversation: ConversationMessage[];
  isListening: boolean;
  onToggleConversation: () => void;
  onStopSharing: () => void;
  error: string | null;
}

const InstructionsPanel: React.FC<InstructionsPanelProps> = ({
  conversation,
  isListening,
  onToggleConversation,
  onStopSharing,
  error,
}) => {
  const conversationEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg flex flex-col h-full w-full">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-bold text-white">Instrucciones del Tutor</h2>
      </div>
      
      <div className="flex-grow p-4 overflow-y-auto">
        {conversation.length === 0 && !isListening && (
          <div className="text-gray-400 text-center mt-8">
            <p>Presiona el botón de micrófono para comenzar a hablar con el tutor.</p>
          </div>
        )}
        {conversation.map((msg, index) => (
          <div key={index} className={`mb-4 flex ${msg.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`rounded-lg p-3 max-w-xs lg:max-w-md ${
              msg.speaker === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-200'
            }`}>
              <p className="font-bold capitalize">{msg.speaker === 'user' ? 'Tú' : 'Tutor'}</p>
              <p>{msg.text}</p>
            </div>
          </div>
        ))}
        <div ref={conversationEndRef} />
      </div>

      {error && (
        <div className="m-4 p-3 bg-red-900 border border-red-700 text-red-200 rounded-lg">
          <p className="font-semibold">Error:</p>
          <p>{error}</p>
        </div>
      )}

      <div className="p-4 border-t border-gray-700 flex items-center justify-center space-x-4">
        <button
          onClick={onToggleConversation}
          className={`p-4 rounded-full transition-colors duration-300 ${
            isListening ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
          }`}
          aria-label={isListening ? 'Dejar de escuchar' : 'Empezar a escuchar'}
        >
          {isListening ? (
            <MicrophoneOffIcon className="w-8 h-8 text-white" />
          ) : (
            <MicrophoneIcon className="w-8 h-8 text-white" />
          )}
        </button>
        <button
          onClick={onStopSharing}
          className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg flex items-center transition-colors duration-300"
          aria-label="Dejar de compartir"
        >
          <StopCircleIcon className="w-6 h-6 mr-2" />
          <span>Dejar de Compartir</span>
        </button>
      </div>
    </div>
  );
};

export default InstructionsPanel;
