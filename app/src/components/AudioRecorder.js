'use client';

import React, { useState, useRef, useEffect } from 'react';

const AudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('');
  const [audioUrl, setAudioUrl] = useState(null); // For processed audio
  const [isLoading, setIsLoading] = useState(false); // Loading state
  const mediaRecorderRef = useRef(null);
  const socketRef = useRef(null);
  const audioChunksRef = useRef([]); // For raw recorded audio
  const processedAudioChunksRef = useRef([]); // For processed audio from server
  const audioPlayerKeyRef = useRef(0); // Key to force re-rendering of the audio player

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8000/ws/audio');
    socketRef.current = socket;

    socket.onopen = () => setStatus('WebSocket connected.');

    socket.onmessage = (event) => {
      const chunk = event.data;
      processedAudioChunksRef.current.push(chunk);

      const processedBlob = new Blob(processedAudioChunksRef.current, { type: 'audio/wav' });
      const url = URL.createObjectURL(processedBlob);

      // Revoke the previous URL to free up memory
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }

      setAudioUrl(url);
      setIsLoading(false);
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setStatus('WebSocket error. Check server connection.');
      setIsLoading(false);
    };

    socket.onclose = () => setStatus('WebSocket closed.');

    return () => socketRef.current?.close();
  }, [audioUrl]);

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

      processedAudioChunksRef.current = [];
      setAudioUrl(null);

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
      mediaRecorderRef.current.onstop = () => {
        setIsRecording(false);
        setStatus('Recording stopped.');
        sendRecordedAudio();
      };

      mediaRecorderRef.current.stop();
    }
  };

  const sendRecordedAudio = () => {
    if (audioChunksRef.current.length === 0) {
      console.warn('No audio data to send.');
      return;
    }

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      audioBlob.arrayBuffer().then((buffer) => {
        socketRef.current.send(buffer);
        setStatus('Translating audio...');
        setIsLoading(true);
      });
    } else {
      console.warn('WebSocket is not open. Cannot send audio.');
      setStatus('Refresh the page to start a new translation session.');
    }
  };

  const playAudio = () => {
    const audioPlayer = document.getElementById('audio-player');
    if (audioPlayer) {
      audioPlayer.play();
    }
  };

  const deleteAudio = () => {
    // Clear audio data
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl); // Revoke the object URL to free memory
    }

    setAudioUrl(null);
    processedAudioChunksRef.current = [];
    setStatus('Audio deleted.');

    // Force re-render of the audio player by updating its key
    audioPlayerKeyRef.current += 1;
  };

  const saveAudio = async () => {
    if (!audioUrl) {
      setStatus('No audio to save.');
      return;
    }

    try {
      const response = await fetch(audioUrl);
      const blob = await response.blob();

      const formData = new FormData();
      formData.append('audio', blob, 'audio.wav');

      const result = await fetch('http://localhost:8000/store', {
        method: 'POST',
        body: formData,
      });

      if (result.ok) {
        setStatus('Audio saved successfully!');
      } else {
        setStatus('Failed to save audio.');
      }

      // Clear the audio data (similar to delete)
      deleteAudio(); // Reset the component after saving

    } catch (error) {
      console.error('Error saving audio:', error);
      setStatus('Error occurred while saving audio.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg space-y-6">
        <h1 className="text-2xl font-semibold text-center text-gray-800">Audio Translator</h1>
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
          {isLoading && (
            <div className="flex justify-center items-center space-x-2">
              <div className="w-5 h-5 rounded-full bg-blue-500 animate-bounce"></div>
              <div className="w-5 h-5 rounded-full bg-blue-500 animate-bounce delay-75"></div>
              <div className="w-5 h-5 rounded-full bg-blue-500 animate-bounce delay-150"></div>
            </div>
          )}

          {audioUrl && (
            <div className="space-y-2">
              <audio
                key={audioPlayerKeyRef.current} // Force re-render on delete
                id="audio-player"
                src={audioUrl}
                controls
                className="w-full h-10"
              />
              <div className="flex space-x-4 justify-center">
                <button
                  onClick={deleteAudio}
                  className="py-2 px-4 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition"
                >
                  Delete
                </button>
                <button
                  onClick={saveAudio}
                  className="py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AudioRecorder;
