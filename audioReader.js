self.onmessage = function(e) {
    const file = e.data.file;

    // Use FileReader to read the file
    const reader = new FileReader();
    reader.onload = function(fileEvent) {
        const audioContext = new AudioContext();
        audioContext.decodeAudioData(fileEvent.target.result, function(buffer) {
            // Create an analyser node
            const analyser = audioContext.createAnalyser();
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(analyser);
            analyser.connect(audioContext.destination);

            // Frequency data
            const frequencyData = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(frequencyData);

            // Time domain data
            const timeDomainData = new Uint8Array(analyser.fftSize);
            analyser.getByteTimeDomainData(timeDomainData);

            // Post results back to main thread
            self.postMessage({frequencyData, timeDomainData});
        });
    };
    reader.readAsArrayBuffer(file);
};

self.onerror = function(error) {
    console.error('Worker error:', error);
};
