import React from 'react';
import { ShareScreenIcon } from './icons';

interface WelcomeScreenProps {
  onStartSharing: () => void;
  error: string | null;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStartSharing, error }) => {
  return (
    <div className="w-full max-w-2xl text-center">
      <h1 className="text-4xl font-bold text-white mb-4">Bienvenido al Tutor Digital Edwin</h1>
      <p className="text-lg text-gray-300 mb-8">
        Comparte tu pantalla y obtén ayuda paso a paso con tus tareas. Edwin te guiará por voz en tiempo real.
      </p>
      <button
        onClick={onStartSharing}
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg inline-flex items-center transition-colors duration-300"
      >
        <ShareScreenIcon className="w-6 h-6 mr-2" />
        <span>Compartir Pantalla</span>
      </button>
      {error && (
        <div className="mt-6 p-4 bg-red-900 border border-red-700 text-red-200 rounded-lg">
          <p className="font-semibold">Error:</p>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};

export default WelcomeScreen;
