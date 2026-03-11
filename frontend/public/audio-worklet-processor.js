/**
 * AudioWorklet Processor for capturing microphone audio
 * Converts Float32 samples to Int16 PCM and sends to main thread
 */
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2048; // Collect samples before sending
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  /**
   * Convert Float32 audio samples to Int16 PCM
   * Gemini expects 16-bit PCM audio
   */
  float32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      // Clamp the value to [-1, 1] range
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      // Convert to 16-bit integer
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];

    // Check if we have audio input
    if (input && input.length > 0 && input[0].length > 0) {
      const channelData = input[0]; // Mono audio (first channel)

      // Add samples to buffer
      for (let i = 0; i < channelData.length; i++) {
        this.buffer[this.bufferIndex++] = channelData[i];

        // When buffer is full, send to main thread
        if (this.bufferIndex >= this.bufferSize) {
          // Convert to Int16 PCM
          const int16Data = this.float32ToInt16(this.buffer);

          // Send to main thread
          this.port.postMessage({
            type: 'audio',
            audio: int16Data.buffer
          }, [int16Data.buffer]); // Transfer ownership for performance

          // Reset buffer
          this.buffer = new Float32Array(this.bufferSize);
          this.bufferIndex = 0;
        }
      }
    }

    // Return true to keep processor alive
    return true;
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
