'use client';

import React, { useState, useRef, useEffect } from 'react';

const AudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('');
  const [audioUrl, setAudioUrl] = useState(null); // For processed audio
  const mediaRecorderRef = useRef(null);
  const socketRef = useRef(null);
  const audioChunksRef = useRef([]); // For raw recorded audio
  const processedAudioChunksRef = useRef([]); // For processed audio from server
  const audioPlayerRef = useRef(null);

  useEffect(() => {
    // Open WebSocket connection on page load
    const socket = new WebSocket('ws://localhost:8000/ws/audio');
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus('WebSocket connected.');
      console.log('WebSocket connection established.');
    };

    socket.onmessage = (event) => {
      const chunk = event.data;
      console.log('Received processed audio chunk');
      processedAudioChunksRef.current.push(chunk);

      // Update the audio URL dynamically to include all received chunks
      const processedBlob = new Blob(processedAudioChunksRef.current, { type: 'audio/wav' });
      const url = URL.createObjectURL(processedBlob);
      setAudioUrl(url);
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setStatus('WebSocket error. Check server connection.');
    };

    socket.onclose = () => {
      setStatus('WebSocket closed.');
      console.log('WebSocket connection closed.');
    };

    // Cleanup WebSocket on component unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (error) => {
        console.error('MediaRecorder error:', error);
        stopRecording();
      };

      mediaRecorder.start();
      setIsRecording(true);
      setStatus('Recording...');
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setStatus('Failed to access microphone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
    setStatus('Recording stopped.');

    // Send the recorded audio to the server
    sendRecordedAudio();
  };

  const sendRecordedAudio = () => {
    if (audioChunksRef.current.length === 0) {
      console.warn('No audio data to send.');
      return;
    }

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      audioBlob.arrayBuffer().then((buffer) => {
        socketRef.current.send(buffer); // Send the entire recorded audio for processing
        setStatus('Sending recorded audio for processing...');
      });
    } else {
      console.warn('WebSocket is not open. Cannot send audio.');
      setStatus('WebSocket is not open.');
    }
  };

  const playAudio = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.play();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg space-y-6">
        <h1 className="text-2xl font-semibold text-center text-gray-800">Audio Recorder</h1>
        <p className="text-center text-gray-500">Status: {status}</p>

        <div className="flex justify-center">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-full py-2 rounded-lg font-medium text-white ${
              isRecording ? 'bg-red-600' : 'bg-green-600'
            } hover:bg-opacity-80 transition`}
          >
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>
        </div>

        <div className="text-center">
          {audioUrl && (
            <div className="space-y-2">
              <audio ref={audioPlayerRef} src={audioUrl} controls className="w-full h-10" />
              <button
                onClick={playAudio}
                className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
              >
                Play Processed Audio
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AudioRecorder;
