import { useEffect, useRef, useState, useCallback } from 'react';
import Header from './components/Header';
import CameraSection from './components/CameraSection';
import InfoPanel from './components/InfoPanel';
import { useAppState } from './hooks/useAppState';
import { DetectionService } from './services/DetectionService';
import { CameraService } from './services/CameraService';
import { RootFactsService } from './services/RootFactsService';
import { APP_CONFIG, isValidDetection } from './utils/config';

function App() {
  const { state, actions } = useAppState();
  const loopTimeoutRef = useRef(null);
  const isRunningRef = useRef(false);
  const isProcessingRef = useRef(false);
  const [currentTone, setCurrentTone] = useState('normal');

  // Sync state.isRunning with ref for the loop
  useEffect(() => {
    isRunningRef.current = state.isRunning;
    if (state.isRunning && !isProcessingRef.current) {
      startDetectionLoop();
    } else {
      stopDetectionLoop();
    }
  }, [state.isRunning]);

  // Handle tone changes
  useEffect(() => {
    if (state.services.generator) {
      state.services.generator.setTone(currentTone);
    }
  }, [currentTone, state.services.generator]);

  // Initialize services on mount
  useEffect(() => {
    let isMounted = true;
    const initServices = async () => {
      try {
        actions.setModelStatus('Memuat AI...');
        
        const detector = new DetectionService();
        const camera = new CameraService();
        const generator = new RootFactsService();

        // Start loading both models in parallel
        await Promise.all([
          detector.loadModel(),
          generator.loadModel()
        ]);

        if (!isMounted) return;

        actions.setServices({ detector, camera, generator });
        actions.setModelStatus('Siap');
      } catch (error) {
        if (isMounted) {
          console.error("Initialization Error:", error);
          actions.setError(error.message || "Gagal memuat model");
          actions.setModelStatus('Error');
        }
      }
    };

    initServices();

    return () => {
      isMounted = false;
      stopDetectionLoop();
      if (state.services.camera) {
        state.services.camera.stopCamera();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stopDetectionLoop = () => {
    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }
  };

  const startDetectionLoop = useCallback(async () => {
    if (!isRunningRef.current || isProcessingRef.current) return;
    
    const { detector, camera, generator } = state.services;
    
    if (detector && camera && camera.isReady() && detector.isLoaded()) {
      try {
        const result = await detector.predict(camera.video);
        
        if (isValidDetection(result)) {
          // Valid detection found
          isProcessingRef.current = true;
          actions.setAppState('analyzing');
          actions.setDetectionResult(result);
          
          setTimeout(async () => {
            try {
              if (generator.isReady()) {
                const fact = await generator.generateFacts(result.className);
                
                setTimeout(() => {
                  actions.setFunFactData({ text: fact, tone: currentTone });
                  actions.setAppState('result');
                  isProcessingRef.current = false;
                }, APP_CONFIG.factsGenerationDelay);
              }
            } catch (err) {
              console.error(err);
              actions.setError("Gagal membuat fun fact");
              actions.setAppState('idle');
              isProcessingRef.current = false;
            }
          }, APP_CONFIG.analyzingDelay);
          
          return; // Stop loop while processing
        }
      } catch (err) {
        console.error("Detection Error:", err);
      }
    }

    // Schedule next frame
    loopTimeoutRef.current = setTimeout(() => {
      startDetectionLoop();
    }, APP_CONFIG.detectionRetryInterval);
    
  }, [state.services, currentTone, actions]);

  // Expose copy to clipboard function globally or pass it down, wait, the App needs to pass it down or implement it
  // Since we only need to "menyalin fakta ke clipboard", we can use a window func or do it here.
  // Actually, InfoPanel likely uses window.copyToClipboard or similar? Let me check InfoPanel.jsx.
  // Wait, I will just export a function or attach it to window if needed. 
  // Let me view InfoPanel.jsx first to see how it expects copy functionality.

  return (
    <div className="app-container">
      <Header modelStatus={state.modelStatus} />

      <main className="main-content">
        <CameraSection
          isRunning={state.isRunning}
          services={state.services}
          modelStatus={state.modelStatus}
          error={state.error}
          currentTone={currentTone}
          onToneChange={setCurrentTone}
          onToggleRunning={(running) => actions.setRunning(running)}
          onReset={() => actions.resetResults()}
        />

        <InfoPanel
          appState={state.appState}
          detectionResult={state.detectionResult}
          funFactData={state.funFactData}
          error={state.error}
          onCopy={() => {
            if (state.funFactData?.text) {
              navigator.clipboard.writeText(state.funFactData.text)
                .then(() => alert("Teks berhasil disalin!"))
                .catch(err => console.error("Gagal menyalin: ", err));
            }
          }}
        />
      </main>

      <footer className="footer">
        <p>Powered by TensorFlow.js & Transformers.js</p>
      </footer>

      {state.error && (
        <div style={{
          position: 'fixed',
          bottom: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: '380px',
          padding: '0.875rem 1rem',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-md)',
          color: '#991b1b',
          fontSize: '0.8125rem',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          zIndex: 1000
        }}>
          <strong>Error:</strong> {state.error}
          <button
            onClick={() => actions.setError(null)}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              color: '#991b1b',
              padding: 0,
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
