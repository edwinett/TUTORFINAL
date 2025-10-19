import React, { useState, useRef, useCallback, useEffect } from 'react';
// FIX: Import types from @google/genai
// FIX: Module '"@google/genai"' has no exported member 'LiveSession'. It has been removed from the import and its usage was updated to `any`.
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import WelcomeScreen from './components/WelcomeScreen';
import TutorView from './components/TutorView';
import { decode, encode, decodeAudioData } from './utils/audioUtils';

// Type for conversation messages
type ConversationMessage = {
  speaker: 'user' | 'tutor';
  text: string;
};

// Constants for screen and audio capture
const FRAME_RATE = 1; // 1 frame per second
const JPEG_QUALITY = 0.7;

const App: React.FC = () => {
  // UI State
  const [isSharing, setIsSharing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Media streams and contexts
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const micStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);

  // Gemini session and related state
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  
  // Audio playback queue management
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  // Transcription state
  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');

  // Helper to convert blob to base64
  const blobToBase64 = (blob: globalThis.Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        resolve(base64data.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Helper to create a Gemini API Blob from audio data
  const createAudioBlob = (data: Float32Array): Blob => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    return {
      data: encode(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
  };
  
  const startGeminiSession = useCallback(async () => {
    setError(null);
    try {
      // FIX: Initialize GoogleGenAI with named apiKey parameter
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Fenrir' } // Male voice
            }
          },
          systemInstruction: 'You are a friendly and helpful digital tutor named Edwin. Guide the user through their tasks based on their shared screen and voice commands. Be concise and clear in your instructions.',
        },
        callbacks: {
          onopen: () => {
            console.log('Gemini session opened.');
            // Start streaming screen frames
            if (videoRef.current) {
              const videoEl = videoRef.current;
              const ctx = canvasRef.current.getContext('2d');
              if (!ctx) {
                setError('Could not get canvas context.');
                return;
              }

              frameIntervalRef.current = window.setInterval(() => {
                canvasRef.current.width = videoEl.videoWidth;
                canvasRef.current.height = videoEl.videoHeight;
                ctx.drawImage(videoEl, 0, 0, videoEl.videoWidth, videoEl.videoHeight);
                canvasRef.current.toBlob(
                  async (blob) => {
                    if (blob && sessionPromiseRef.current) {
                      const base64Data = await blobToBase64(blob);
                      // FIX: Ensure data is streamed only after the session promise resolves.
                      sessionPromiseRef.current.then((session) => {
                        session.sendRealtimeInput({
                          media: { data: base64Data, mimeType: 'image/jpeg' }
                        });
                      });
                    }
                  },
                  'image/jpeg',
                  JPEG_QUALITY
                );
              }, 1000 / FRAME_RATE);
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle transcriptions
            if (message.serverContent?.inputTranscription) {
              currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
            }
            if (message.serverContent?.outputTranscription) {
              currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
            }
            if (message.serverContent?.turnComplete) {
              const userInput = currentInputTranscriptionRef.current.trim();
              const tutorResponse = currentOutputTranscriptionRef.current.trim();
              
              setConversation(prev => {
                const newConversation = [...prev];
                if (userInput) {
                    newConversation.push({ speaker: 'user', text: userInput });
                }
                if (tutorResponse) {
                    newConversation.push({ speaker: 'tutor', text: tutorResponse });
                }
                return newConversation;
              });

              currentInputTranscriptionRef.current = '';
              currentOutputTranscriptionRef.current = '';
            }

            // Handle audio output
            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
            if (audioData) {
              if (!outputAudioContextRef.current) {
                // FIX: Added type assertion for `webkitAudioContext` for cross-browser compatibility.
                outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                outputNodeRef.current = outputAudioContextRef.current.createGain();
                outputNodeRef.current.connect(outputAudioContextRef.current.destination);
              }
              const audioContext = outputAudioContextRef.current;
              
              // Ensure audio context is running
              if (audioContext.state === 'suspended') {
                audioContext.resume();
              }
              
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContext.currentTime);
              const audioBuffer = await decodeAudioData(decode(audioData), audioContext, 24000, 1);
              
              const source = audioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputNodeRef.current!);
              source.addEventListener('ended', () => {
                audioSourcesRef.current.delete(source);
              });

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              audioSourcesRef.current.add(source);
            }
            
            // Handle interruptions
            if (message.serverContent?.interrupted) {
              for (const source of audioSourcesRef.current.values()) {
                source.stop();
              }
              audioSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            console.log('Gemini session closed.');
          },
          onerror: (e) => {
            console.error('Gemini session error:', e);
            setError('An error occurred with the Gemini session. Please try again.');
          },
        },
      });
    } catch (e: any) {
      console.error('Failed to start Gemini session:', e);
      setError(`Failed to initialize Gemini: ${e.message}`);
    }
  }, []);

  const handleStartSharing = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false, // Don't capture audio from the screen share
      });
      setScreenStream(stream);
      setIsSharing(true);
      startGeminiSession();
    } catch (e: any) {
      console.error('Failed to start screen sharing:', e);
      setError(`Could not start screen sharing: ${e.message}`);
    }
  }, [startGeminiSession]);
  
  const cleanup = useCallback(() => {
    // Stop screen share stream
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
    }
    // Stop mic stream
    if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
    }
    // Disconnect audio processor
    if (audioProcessorRef.current) {
        audioProcessorRef.current.disconnect();
        audioProcessorRef.current = null;
    }
    // Close audio contexts
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
        inputAudioContextRef.current.close();
        inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
        outputAudioContextRef.current.close();
        outputAudioContextRef.current = null;
    }
    // Clear frame interval
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    // Close Gemini session
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(session => session.close());
      sessionPromiseRef.current = null;
    }
    // Reset state
    setIsSharing(false);
    setIsListening(false);
    setConversation([]);
    setError(null);
  }, [screenStream]);


  const handleStopSharing = useCallback(() => {
    cleanup();
  }, [cleanup]);
  
  useEffect(() => {
    // Add event listener for when the user stops sharing via the browser UI
    if (screenStream) {
      const videoTrack = screenStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = handleStopSharing;
      }
      return () => {
        if (videoTrack) {
          videoTrack.onended = null;
        }
      };
    }
  }, [screenStream, handleStopSharing]);
  
  const handleToggleConversation = useCallback(async () => {
      setIsListening(prev => {
        const nextIsListening = !prev;
        if (nextIsListening) {
            // Start listening
            navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
                micStreamRef.current = stream;
                if (!sessionPromiseRef.current) {
                    setError('Gemini session is not active.');
                    return;
                }
                
                // FIX: Added type assertion for `webkitAudioContext` for cross-browser compatibility.
                inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                const source = inputAudioContextRef.current.createMediaStreamSource(stream);
                const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                
                scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                    const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                    const pcmBlob = createAudioBlob(inputData);
                    // FIX: Use session promise to prevent stale closures and race conditions
                    sessionPromiseRef.current!.then((session) => {
                      session.sendRealtimeInput({ media: pcmBlob });
                    });
                };

                source.connect(scriptProcessor);
                scriptProcessor.connect(inputAudioContextRef.current.destination);
                audioProcessorRef.current = scriptProcessor;

            }).catch(e => {
                console.error("Error getting microphone:", e);
                setError("Could not access microphone.");
                setIsListening(false);
            });
        } else {
            // Stop listening
            if (micStreamRef.current) {
                micStreamRef.current.getTracks().forEach(track => track.stop());
                micStreamRef.current = null;
            }
            if (audioProcessorRef.current) {
                audioProcessorRef.current.disconnect();
                audioProcessorRef.current = null;
            }
            if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
                inputAudioContextRef.current.close();
                inputAudioContextRef.current = null;
            }
        }
        return nextIsListening;
      });
  }, []);

  return (
    <div className="bg-gray-900 min-h-screen flex items-center justify-center font-sans">
      {isSharing ? (
        <TutorView
          stream={screenStream}
          videoRef={videoRef}
          onStopSharing={handleStopSharing}
          conversation={conversation}
          isListening={isListening}
          onToggleConversation={handleToggleConversation}
          error={error}
        />
      ) : (
        <WelcomeScreen onStartSharing={handleStartSharing} error={error} />
      )}
    </div>
  );
};

export default App;