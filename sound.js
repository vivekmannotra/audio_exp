
export class FFT {
    constructor() {

    }

    // Preprocess input to ensure it's suitable for FFT
    preprocessInput(input) {
        const validInput = input.map(value => ({
                re: typeof value.re === "number" && !isNaN(value.re) ? value.re : 0,
                im: typeof value.im === "number" && !isNaN(value.im) ? value.im : 0
            }));

        const adjustedSize = this.adjustToPowerOfTwo(validInput.length);
        return validInput.slice(0, adjustedSize).concat(
            new Array(adjustedSize - validInput.length).fill({re: 0, im: 0})
        );
    }

    // Main FFT function with preprocessing
    transform(input) {
        if (!input || !Array.isArray(input)) {
            throw new Error("Invalid input for FFT transform.");
        }

        // Preprocess input to replace non-numeric values with 0 and adjust to nearest power of two
        const preprocessedInput = this.preprocessInput(input);
        return this.fft(preprocessedInput, false);
    }

    // Inverse FFT function with data preprocessing
    inverseTransform(input) {
        if (!input || !Array.isArray(input) || input.length !== this.size) {
            throw new Error("Invalid input for FFT inverse transform.");
        }
        const processedInput = this.preprocessData(input);
        return this.fft(processedInput, true);
    }

    // Internal FFT algorithm (recursive Cooley-Tukey)
    fft(input, inverse) {
        const N = input.length;
        if (N <= 1) return input;

        // Filter inputs for even and odd indices, adding null checks
        const even = this.fft(input.filter((_, i) => i % 2 === 0), inverse);
        const odd = this.fft(input.filter((_, i) => i % 2 !== 0), inverse);
        const combined = new Array(N).fill(null).map(() => ({re: 0, im: 0}));

        for (let k = 0; k < N / 2; k++) {
            const angle = 2 * Math.PI * k / N * (inverse ? 1 : -1);
            const exp = { re: Math.cos(angle), im: Math.sin(angle) };
            const term = this.multiplyComplex(odd[k], exp);
            combined[k] = this.addComplex(even[k], term);
            combined[k + N / 2] = this.subtractComplex(even[k], term);
        }

        // Normalize the inverse transform
        if (inverse) {
            return combined.map(c => ({ re: c.re / N, im: c.im / N }));
        }

        return combined;
    }

    // Adjust the array size to the nearest power of two
    adjustToPowerOfTwo(size) {
        return Math.pow(2, Math.ceil(Math.log2(size)));
    }

    // Complex number arithmetic functions
    addComplex(a, b) {
        return { re: a.re + b.re, im: a.im + b.im };
    }

    subtractComplex(a, b) {
        return { re: a.re - b.re, im: a.im - b.im };
    }

    multiplyComplex(a, b) {
        return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
    }

    // Utility function to check if a number is a power of two
    isPowerOfTwo(n) {
        return n && (n & (n - 1)) === 0;
    }
}


export class SoundEngine {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.nextStartTime = this.audioContext.currentTime;
        this.oscillators = [];
        this.recording = false;
        this.startTime = 0;
        this.recordedData = [];
        this.isPlaying = false;

        this.masterGain = this.audioContext.createGain();
        this.masterGain.connect(this.audioContext.destination);

        // Create a band-pass filter
        this.bandPassFilter = this.audioContext.createBiquadFilter();
        this.bandPassFilter.type = 'bandpass';
        this.bandPassFilter.frequency.value = 1000; // Center frequency of the band-pass filter
        this.bandPassFilter.Q.value = 1; // Quality factor controls the bandwidth of the filter

        // Connect the filter to the master gain
        this.bandPassFilter.connect(this.masterGain);

    }

    playSoundFromArray(soundData) {
        if (!this.isPlaying) {
            this.isPlaying = true;
        }
        let startTime = this.audioContext.currentTime;

        soundData.forEach((channels) => {
            channels.forEach(channelData => {
                channelData.forEach(cd => {
                    this.playChannel(cd, startTime);
                });
            });
    	});

        if (this.recording) {
            soundData.forEach(sd => { this.recordedData.push(sd) });
            this.startTime += startTime;
        }
    }

    playChannel(channelData, startTime) {

        const [frequency, real, imag, adsr, panValue] = channelData;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        const panner = this.audioContext.createStereoPanner();
        const analyser = this.audioContext.createAnalyser();
        analyser.fftSize = 1024;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const dataArrayW = new Uint8Array(analyser.fftSize);

        const periodicWave = this.audioContext.createPeriodicWave(new Float32Array(real), new Float32Array(imag));
        oscillator.setPeriodicWave(periodicWave);
        oscillator.frequency.value = frequency;

        panner.pan.setValueAtTime(panValue, startTime);

        oscillator.connect(gainNode);
        gainNode.connect(this.bandPassFilter);
        gainNode.connect(analyser);
        analyser.connect(panner);
        panner.connect(this.audioContext.destination);

        const canvasContext = panValue >= 0 ? setupCanvas(right_fviz) : setupCanvas(left_fviz);
        const canvasContextW = panValue >= 0 ? setupCanvas(right_wviz) : setupCanvas(left_wviz);
        this.oscillators.push(oscillator);
        let frameCount = 100;
        let frameCountW = 100;
        if (document.querySelector("#spectra").style.display != 'none')	drawFrequency((panValue >=0 ? right_fviz : left_fviz), canvasContext, analyser, dataArray, frameCount);
        if (document.querySelector("#wave").style.display != 'none')	drawWaveform((panValue >=0 ? right_wviz : left_wviz), canvasContextW, analyser, dataArrayW, frameCountW);
        if (document.querySelector("#gl_viz").style.display != 'none')	window.gl_viz.startVisualizationLoop(analyser, 10, panValue);

        oscillator.start(startTime);
        oscillator.stop(startTime + adsr.reduce((acc, val) => acc + val, 0));

    }

    applyADSR(gainNode, adsr, startTime, oscillator, peakAmp=1, susAmp=1) {
        const [attack, decay, sustain, release] = adsr;
        gainNode.gain.cancelScheduledValues(startTime);
        gainNode.gain.setValueAtTime(0.001, startTime);
        gainNode.gain.linearRampToValueAtTime(peakAmp, startTime + attack);
        gainNode.gain.linearRampToValueAtTime(susAmp, startTime + attack + decay);
        gainNode.gain.linearRampToValueAtTime(susAmp, startTime + attack + decay + sustain);
        gainNode.gain.linearRampToValueAtTime(0.001, startTime + attack + decay + sustain + release);

    }

    makeDynamicSounds () {
        const baseSoundMap = {
            example_sound: [659.25, 622.25,  659.25,  622.25, 659.25,  493.88, 587.33,  523.25, 440.00, 659.25, 622.25, 659.25,  622.25,  659.25, 493.88, 587.33, 523.25, 440.00],
            drums: [42, 64, 95, 112, 130, 154],
            strings: [48, 82, 110, 147, 196, 247, 330, 393, 444, 500, 534],
            balafon: [185.00, 196.00, 207.65, 220.00, 233.08, 246.94, 261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392.00, 415.30, 440.00, 466.16, 493.88, 523.25, 554.37, 587.33],
            bansuri: [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25],
            tabla: {
                dayan: [246.94, 261.63, 277.18, 293.66],
                bayan: [110.00, 116.54]
            }
        };
        const d_def = [[0, 1, 0], [0,0,0], [1100, 0.1, 0.1, 0]];
        const s_def = [[0, 1, 0.9, 0.8, 0.7, 0.5, 0.4, 0.3], [0, 0, 0, 0 , 0, 0, 0 ,0], [1100, 0.2, 0.5, 0.1]];
        const p_def = [[0, 1, 0.4, 0.2, 0.1], [0,0.5,0.5, 0.5, 0], [0.1, 0, 0.9, 0]];
        const t_def = [[0,1,0], [0,0,0], [0.1, 0.1, 0.2, 0]];
        const harmonicalDepth = 1;
        const stereoChannels = [-1, 1];
        const soundDefinitions = {};

        const makeDefInstHarmonic = (def, type, i) => {
            const decayReduction = 1.2;
            const sustainLevelAdjustment = 0.8;
            let temp_def = JSON.parse(JSON.stringify(def));
            const curvedResponse = n => Math.round(Math.exp(-n / (20+n)) * 1000);
            if (type == 'drum') temp_def[2][0] = (parseFloat((temp_def[2][0] - curvedResponse(i))/10000));
            if (type == 'string') temp_def[2][0] = (parseFloat((temp_def[2][0] - curvedResponse(i))/1000));
            //temp_def[2][1] = temp_def[2][1] * Math.pow(decayReduction, i);
            //temp_def[2][2] = temp_def[2][1] * Math.pow(sustainLevelAdjustment, i);
            return temp_def
        };

        const makeIntrumentHarmonics = (frequency, index, type, def) => {
            let harmonics = [];
            let harmonicDecayFactor = 0.8;

            harmonics.push([frequency].concat(makeDefInstHarmonic(def, type, index)))

            for (let n = 1; n <= harmonicalDepth; n++) {
                let harmonicFreq = frequency * (n + 1);
                let amplitude = Math.pow(harmonicDecayFactor, n);
                let h_def = makeDefInstHarmonic(def, type, n);
                h_def[2].push(amplitude, 0);
                harmonics.push([ harmonicFreq ].concat(h_def));
            }

            for (let n = 1; n <= harmonicalDepth; n++) {
                let octaveFreq = frequency / Math.pow(2, n);
                if (octaveFreq >= 20) {
                    let amplitude = 1 / n;
                    let h_def = makeDefInstHarmonic(def, type, n);
                    h_def[2].push(amplitude, 0);
                    harmonics.unshift([ octaveFreq ].concat(h_def));
                }
            }

            return harmonics;
        };

        const expandIntrumentSound = (baseFrequencies, type, def) => {
            const harmonicSound = baseFrequencies.map((f, i) => {
                    return makeIntrumentHarmonics(f, i, type, def)
            });
            const stereoSound = harmonicSound.map(hs => {
                    return stereoChannels.map(st => {
                        return hs.map(hss => hss.concat(st))
                });
            });
            return stereoSound;
        };

        soundDefinitions.example_sound = expandIntrumentSound(baseSoundMap.example_sound, 'keys', p_def);
        soundDefinitions.drumSounds = expandIntrumentSound(baseSoundMap.drums, 'drum', d_def).map((ds, i) => { return [`DS${i}`, ds]});

        soundDefinitions.stringSounds = baseSoundMap.strings.map((ss, i) => {
                return [ `SS${i}`, ss, function (f) {
                    return expandIntrumentSound([f], 'string', s_def)
                }];
        });

        soundDefinitions.balafon = expandIntrumentSound(baseSoundMap.balafon, 'balafon', t_def).map((bs, i) => { return [`BS${i}`, bs]});
        soundDefinitions.tabla = {};
        soundDefinitions.tabla.dayan = expandIntrumentSound(baseSoundMap.tabla.dayan, 'tabla', t_def).map((ts, i) => { return [`TS${i}`, ts]});
        soundDefinitions.tabla.bayan = expandIntrumentSound(baseSoundMap.tabla.bayan, 'tabla', t_def).map((ts, i) => { return [`TS${i}`, ts]});
        soundDefinitions.bansuri = expandIntrumentSound(baseSoundMap.bansuri, 'bansuri', t_def).map((bs, i) => { return [`BS${i}`, bs]});

        soundDefinitions.keys = function (i) {
            return expandIntrumentSound([calculateFrequency(i)], 'keys', p_def)
        };
        return soundDefinitions;
    }

    pause() {
        if (this.isPlaying) {
            this.audioContext.suspend();
            this.isPlaying = false;
        }
    }

    stop() {
        if (this.isPlaying) {
            this.oscillators.forEach(oscillator => oscillator.stop());
            this.oscillators = [];
            this.audioContext.close();
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.isPlaying = false;
        }
    }

    record() {
        this.recording = !this.recording;
    }

}


export function setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr); // Scale all drawing operations by the dpr, making them crisp

    ctx.font = '8px Arial'; // Adjust font size as needed
    ctx.textAlign = 'left'; // Reset or set text alignment as needed
    ctx.textBaseline = 'middle'; // Adjust baseline as needed

    return ctx; // In case you need to work with context directly afterward
}

export function drawFrequency(canvas, canvasContext, analyser, dataArray, frameCount) {
	if (canvasContext && frameCount) {

	    	analyser.getByteFrequencyData(dataArray);

	drawAxesWithLabels(canvas, canvasContext, analyser);

const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    const padding = 20; // Ensure this matches with drawAxesAndLabels
    const barWidth = (width - 2 * padding) / dataArray.length;
    const nyquistFrequency = analyser.context.sampleRate / 2;

    canvasContext.clearRect(padding, padding, width - 2 * padding, height - 2 * padding); // Clear only the chart area

    for (let i = 0; i < dataArray.length; i++) {
        const value = dataArray[i];
        const barHeight = (value / 255.0) * (height - 2 * padding); // Scale bar height to canvas size and padding
        const x = padding + i * barWidth;
        const y = height - padding - barHeight; // Start drawing bars up from the bottom padding

        canvasContext.fillStyle = window.currentTheme;
        canvasContext.fillRect(x, y, barWidth, barHeight);
    }
	frameCount--;
	requestAnimationFrame(() => drawFrequency(canvas, canvasContext, analyser, dataArray, frameCount));


	}

}


export function drawWaveform(canvas, canvasContext, analyser, dataArray, frameCount) {
	if (canvasContext && frameCount) {

    	analyser.getByteTimeDomainData(dataArray);

	drawWaveformAxes(canvas, canvasContext, analyser);
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    const padding = 20; // Padding around the canvas

    const segmentWidth = (width - 2 * padding) / dataArray.length;

        canvasContext.clearRect(padding, padding, width - 2 * padding, height - 2 * padding); // Clear the chart area

        canvasContext.beginPath();
        canvasContext.strokeStyle = window.currentTheme;
        for (let i = 0; i < dataArray.length; i++) {
            const value = dataArray[i];
            const x = padding + i * segmentWidth;
            const y = ((value / 255.0) * (height - 2 * padding)) + padding;

            if (i === 0) {
                canvasContext.moveTo(x, y);
            } else {
                canvasContext.lineTo(x, y);
            }
        }
        canvasContext.stroke();
	frameCount--;
	requestAnimationFrame(() => drawWaveform(canvas, canvasContext, analyser, dataArray, frameCount));


	}
}


function drawAxesWithLabels(canvas, canvasContext, analyser) {
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    const padding = 20; // Space for labels

    // Clear canvas and prepare for drawing axes
    canvasContext.clearRect(0, 0, width, height);

    // Draw X-axis at the bottom
    canvasContext.beginPath();
    canvasContext.moveTo(padding, height - padding);
    canvasContext.lineTo(width - padding, height - padding);
    canvasContext.stroke();

    // Draw Y-axis on the left
    canvasContext.beginPath();
    canvasContext.moveTo(padding, height - padding);
    canvasContext.lineTo(padding, padding);
    canvasContext.stroke();

    // Frequency labels for X-axis
    const freqLabelsCount = 10; // Adjust based on preference
    const nyquistFrequency = analyser.context.sampleRate / 2;
    for (let i = 0; i <= freqLabelsCount; i++) {
        const x = padding + (i / freqLabelsCount) * (width - 2 * padding);
        const frequency = (i / freqLabelsCount) * nyquistFrequency;
        // Draw tick
        canvasContext.beginPath();
        canvasContext.moveTo(x, height - padding);
        canvasContext.lineTo(x, height - padding + 5);
        canvasContext.stroke();
        // Draw label
        canvasContext.fillText(`${Math.round(frequency)}Hz`, x, height - 5);
    }

    // Amplitude labels for Y-axis
    const ampLabelsCount = 5; // Adjust based on preference
    for (let i = 0; i <= ampLabelsCount; i++) {
        const y = height - padding - (i / ampLabelsCount) * (height - 2 * padding);
        // Draw tick
        canvasContext.beginPath();
        canvasContext.moveTo(padding, y);
        canvasContext.lineTo(padding - 5, y);
        canvasContext.stroke();
        // Draw label
        canvasContext.fillText(`${i * 20}%`, 0, y); // Example: amplitude as a percentage
    }

    canvasContext.textAlign = 'center'; // Reset text alignment for general use

}


function drawWaveformAxes(canvas, canvasContext) {
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    const padding = 20; // Space for labels

    // Clear canvas and prepare for drawing axes
    canvasContext.clearRect(0, 0, width, height);

    // Draw X-axis at the bottom
    canvasContext.beginPath();
    canvasContext.moveTo(padding, height - padding);
    canvasContext.lineTo(width - padding, height - padding);
    canvasContext.stroke();

    // Draw Y-axis on the left
    canvasContext.beginPath();
    canvasContext.moveTo(padding, height - padding);
    canvasContext.lineTo(padding, padding);
    canvasContext.stroke();

    // Time labels for X-axis (assuming total duration is accessible)
    const timeLabelsCount = 10; // Adjust based on preference
    const totalDuration = 1; // Placeholder, replace with actual duration in seconds
    for (let i = 0; i <= timeLabelsCount; i++) {
        const x = padding + (i / timeLabelsCount) * (width - 2 * padding);
        const time = (i / timeLabelsCount) * totalDuration;
        // Draw tick
        canvasContext.beginPath();
        canvasContext.moveTo(x, height - padding);
        canvasContext.lineTo(x, height - padding + 5);
        canvasContext.stroke();
        // Draw label
        canvasContext.fillText(`${time.toFixed(2)}s`, x, height - 5);
    }

    // Amplitude labels for Y-axis
    const ampLabelsCount = 5; // Adjust based on preference
    for (let i = 0; i <= ampLabelsCount; i++) {
        const amplitude = -1 + (i / ampLabelsCount) * 2; // Normalize between -1 and 1
        const y = height - padding - (i / ampLabelsCount) * (height - 2 * padding);
        // Draw tick
        canvasContext.beginPath();
        canvasContext.moveTo(padding, y);
        canvasContext.lineTo(padding - 5, y);
        canvasContext.stroke();
        // Considering amplitude is normalized, label accordingly
        canvasContext.fillText(`${amplitude.toFixed(1)}`, 0, y);
    }

    canvasContext.textAlign = 'center'; // Reset text alignment for general use
}
