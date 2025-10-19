import React, { useEffect } from 'react';

interface ScreenDisplayProps {
  stream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement>;
}

const ScreenDisplay: React.FC<ScreenDisplayProps> = ({ stream, videoRef }) => {
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, videoRef]);

  return (
    <div className="bg-black rounded-lg overflow-hidden shadow-lg w-full h-full flex items-center justify-center">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-contain"
        muted
      />
    </div>
  );
};

export default ScreenDisplay;
