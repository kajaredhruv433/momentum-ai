import React, { useRef, useEffect, useState } from 'react';
import { Video, VideoOff, Camera, User } from 'lucide-react';

export default function CandidateCamera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(true);
  const [hasPermission, setHasPermission] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  // Initialize webcam stream
  const startCamera = async () => {
    try {
      setErrorMessage(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false, // Explicitly no audio recording
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasPermission(true);
      setCameraActive(true);
    } catch (err) {
      console.warn('[CandidateCamera] Camera stream unavailable:', err);
      setHasPermission(false);
      setCameraActive(false);
      setErrorMessage(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied.'
          : 'Webcam not detected or in use.'
      );
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const toggleCamera = () => {
    if (cameraActive) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div
      className="card"
      style={{
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        background: 'rgba(16, 20, 31, 0.75)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* Header with Live indicator & Not Recorded badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Camera size={16} color="var(--primary-light)" />
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Candidate View
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {cameraActive && (
            <span
              style={{
                display: 'inline-block',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: '#34d399',
                boxShadow: '0 0 6px #34d399',
              }}
            />
          )}
          <span
            style={{
              fontSize: '0.68rem',
              color: 'var(--text-dim)',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            Not Recorded
          </span>
        </div>
      </div>

      {/* Video Preview Container */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          paddingTop: '65%', // ~16:10 aspect ratio
          background: '#0a0d16',
          borderRadius: '10px',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: 'inset 0 0 16px rgba(0, 0, 0, 0.6)',
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)', // Mirror effect
            display: cameraActive ? 'block' : 'none',
          }}
        />

        {/* Fallback avatar when camera is disabled or denied */}
        {!cameraActive && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              color: 'var(--text-muted)',
              padding: '12px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <User size={22} color="var(--text-dim)" />
            </div>
            <span style={{ fontSize: '0.74rem' }}>
              {errorMessage || 'Camera is off'}
            </span>
          </div>
        )}
      </div>

      {/* Toggle Camera Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          className={`btn ${cameraActive ? 'btn-secondary' : 'btn-primary'}`}
          onClick={toggleCamera}
          style={{
            padding: '5px 12px',
            fontSize: '0.74rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
          title={cameraActive ? 'Turn off camera preview' : 'Turn on camera preview'}
        >
          {cameraActive ? (
            <>
              <VideoOff size={14} />
              <span>Turn Off Camera</span>
            </>
          ) : (
            <>
              <Video size={14} />
              <span>Turn On Camera</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
