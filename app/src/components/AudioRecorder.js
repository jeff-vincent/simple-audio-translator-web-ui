'use client';

import React, { useState, useRef } from 'react';

const AudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('');
  const [audioUrl, setAudioUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const socketRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioBlobRef = useRef(null);
  const audioPlayerRef = useRef(null);

  const startRecording = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStatus('Initializing WebSocket...');

      // Initialize WebSocket connection
      const socket = new WebSocket('ws://localhost:8000/ws/audio');
      socketRef.current = socket;

      socket.onopen = () => {
        setStatus('WebSocket connected. Starting recording...');
        
        // Initialize MediaRecorder
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        // Handle audio data
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
            sendAudioChunk(event.data);
          }
        };

        // Handle errors
        mediaRecorder.onerror = (error) => {
          console.error('MediaRecorder error:', error);
          stopRecording();
        };

        // Start recording
        mediaRecorder.start(1000); // Send data every second
        setIsRecording(true);
        setStatus('Recording...');
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setStatus('WebSocket error. Check server connection.');
      };

      socket.onclose = () => {
        setStatus('WebSocket closed.');
      };

      // Handle receiving processed audio from server
      socket.onmessage = (event) => {
        const chunk = event.data;
        console.log('Received processed audio chunk');
        audioChunksRef.current.push(chunk);
        audioBlobRef.current = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const url = URL.createObjectURL(audioBlobRef.current);
        setAudioUrl(url);
      };
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setStatus('Failed to access microphone.');
    }
  };

  const sendAudioChunk = (chunk) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(chunk);
      setStatus('Sending audio chunk...');
    } else {
      console.warn('WebSocket is not open. Cannot send audio chunk.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    if (socketRef.current) {
      socketRef.current.close();
    }
    setIsRecording(false);
    setStatus('Recording stopped.');
  };

  const playAudio = () => {
    if (audioPlayerRef.current && audioBlobRef.current) {
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

  