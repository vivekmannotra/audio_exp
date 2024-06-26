import * as glMatrix from './gl-matrix/esm/index.js';


export default class SoundViz {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.gl = this.canvas.getContext("webgl");
        if (this.gl === null) {
            alert("Unable to initialize WebGL. Your browser may not support it.");
            return;
        }
	// Initialize mouse control state
        this.isMouseDown = false;
        this.lastMouseX = null;
        this.lastMouseY = null;
	const pixelRatio = window.devicePixelRatio || 1;
    const width = this.canvas.clientWidth * pixelRatio;
    const height = this.canvas.clientHeight * pixelRatio;
    if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }	
	this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
	this.timeVizInc = 0.005;
	this.axesVertices = new Float32Array([
        // X-axis (red)
        -2.0, 0.0, 0.0,
        2.0, 0.0, 0.0,
        // Y-axis (green)
        0.0, -2.0, 0.0,
        0.0, 2.0, 0.0,
        // Z-axis (blue)
        0.0, 0.0, -2.0,
        0.0, 0.0, 2.0
    ]);

    this.axesColors = new Float32Array([
        // X-axis color (red)
        1.0, 0.0, 0.0, 1.0,
        1.0, 0.0, 0.0, 1.0,
        // Y-axis color (green)
        0.0, 1.0, 0.0, 1.0,
        0.0, 1.0, 0.0, 1.0,
        // Z-axis color (blue)
        0.0, 0.0, 1.0, 1.0,
        0.0, 0.0, 1.0, 1.0
    ]);


        this.initEventListeners();
        this.initWebGL();
    }

    initWebGL() {
        if (!this.gl) {
            alert("Unable to initialize WebGL. Your browser may not support it.");
            return;
        }

        this.vertexShaderSource = `
          uniform mat4 uModelViewMatrix;
          uniform mat4 uProjectionMatrix;
          attribute vec4 aVertexPosition;
         attribute vec4 aVertexColor;
        uniform bool useVertexColor;
        uniform vec4 defaultColor;
        varying lowp vec4 vColor;
          void main() {
            gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
            gl_PointSize = 2.0;
            vColor = useVertexColor ? aVertexColor : defaultColor;
          }`;
        this.fragmentShaderSource = `
            varying lowp vec4 vColor;
              void main() {
                gl_FragColor = vColor;
              }`;

        this.compileShader(this.vertexShaderSource, this.gl.VERTEX_SHADER);
    this.compileShader(this.fragmentShaderSource, this.gl.FRAGMENT_SHADER);

        this.createProgram();
        this.initializeBuffers();
        this.initializeCamera();
    }

    compileShader(source, type) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            alert('An error occurred compiling the shaders: ' + this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    createProgram() {
        const vertexShader = this.compileShader(this.vertexShaderSource, this.gl.VERTEX_SHADER);
        const fragmentShader = this.compileShader(this.fragmentShaderSource, this.gl.FRAGMENT_SHADER);

        const shaderProgram = this.gl.createProgram();
        this.gl.attachShader(shaderProgram, vertexShader);
        this.gl.attachShader(shaderProgram, fragmentShader);
        this.gl.linkProgram(shaderProgram);

        if (!this.gl.getProgramParameter(shaderProgram, this.gl.LINK_STATUS)) {
            alert('Unable to initialize the shader program: ' + this.gl.getProgramInfoLog(shaderProgram));
            return;
        }

        this.programInfo = {
            program: shaderProgram,
            attribLocations: {
                vertexPosition: this.gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
		        vertexColor: this.gl.getAttribLocation(shaderProgram, 'aVertexColor')
            },
            uniformLocations: {
		        useVertexColor: this.gl.getUniformLocation(shaderProgram, 'useVertexColor'),
		        defaultColor: this.gl.getUniformLocation(shaderProgram, 'defaultColor'),
                projectionMatrix: this.gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
                modelViewMatrix: this.gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
            },
        };
    }

    initializeBuffers() {
        this.positionBuffer = this.gl.createBuffer();

	this.axesVertexBuffer = this.gl.createBuffer();
	this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.axesVertexBuffer);
	this.gl.bufferData(this.gl.ARRAY_BUFFER, this.axesVertices, this.gl.STATIC_DRAW);

	this.axesColorBuffer = this.gl.createBuffer();
	this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.axesColorBuffer);
	this.gl.bufferData(this.gl.ARRAY_BUFFER, this.axesColors, this.gl.STATIC_DRAW);



    }

    initializeCamera() {
        this.projectionMatrix = glMatrix.mat4.create();
        glMatrix.mat4.perspective(this.projectionMatrix, -0.5, 1, -1, 1, 0.1, 100);
        this.modelViewMatrix = glMatrix.mat4.create();
        glMatrix.mat4.translate(this.modelViewMatrix, this.modelViewMatrix, [0.0, 0.0, -6.0]);
    }

    updatePositions(positions) {
	    this.positions = positions;
	    this.vertexCount = positions.length / 3;
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);

        this.pointColorBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.pointColorBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.colors), this.gl.STATIC_DRAW);

    }

    draw() {
        this.gl.clearColor(1.0, 1.0, 1.0, 1.0);
        this.gl.clearDepth(1.0);
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthFunc(this.gl.LEQUAL);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

	    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.vertexAttribPointer(this.programInfo.attribLocations.vertexPosition, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexPosition);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.pointColorBuffer);
        this.gl.vertexAttribPointer( this.programInfo.attribLocations.vertexColor, 4, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexColor);

        this.gl.useProgram(this.programInfo.program);
        this.gl.uniformMatrix4fv(this.programInfo.uniformLocations.projectionMatrix, false, this.projectionMatrix);
        this.gl.uniformMatrix4fv(this.programInfo.uniformLocations.modelViewMatrix, false, this.modelViewMatrix);

	    this.gl.uniform1i(this.programInfo.uniformLocations.useVertexColor, 1);
	    //this.gl.uniform4fv(this.programInfo.uniformLocations.defaultColor, [0, 0, 0, 1]);

        this.gl.drawArrays(this.gl.POINTS, 0, this.vertexCount);

        this.gl.disableVertexAttribArray(this.programInfo.attribLocations.vertexColor);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.axesVertexBuffer);
        this.gl.vertexAttribPointer(this.programInfo.attribLocations.vertexPosition, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexPosition);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.axesColorBuffer);
        this.gl.vertexAttribPointer(this.programInfo.attribLocations.vertexColor, 4, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexColor);

        this.gl.uniform1i(this.programInfo.uniformLocations.useVertexColor, 1);

        this.gl.drawArrays(this.gl.LINES, 0, 6);

        this.gl.disableVertexAttribArray(this.programInfo.attribLocations.vertexColor);


        const error = this.gl.getError();
        if (error !== this.gl.NO_ERROR) {
            console.error('WebGL Error:', error);
        }
    }
    startVisualizationLoop(analyser, maxIterations = 100, panValue) {

        let iterationCount = 0;
        this.frequencyPositions = [];
        this.waveformPositions = [];
        this.currentFreqTimeStep = undefined;
        this.currentWaveTimeStep = undefined;
        this.colors = [];
        this.maxIter = maxIterations;
        const drawLoop = () => {

            if (iterationCount <= maxIterations) {
                this.updatePositionsFromAudio(analyser, panValue);
                iterationCount++;
                requestAnimationFrame(drawLoop);
            }

        };

        requestAnimationFrame(drawLoop);
    }


	updatePositionsFromAudio(analyser, panValue) {
        let positions = [];
        positions  = positions.concat(this.updateFrequencyPositions(analyser, panValue));
        positions  = positions.concat(this.updateWaveformPositions(analyser, panValue));

    //freq.forEach((value, index) => { positions.push(-1*index/freq.length);    positions.push(-1*value/peakF);    positions.push(0); });
    //wave.forEach((value, index) => { positions.push(-1*index/wave.length);    positions.push(-1*value/peakW);    positions.push(0); });

          this.updatePositions(positions);
            this.draw();

    }


    updateFrequencyPositions(analyser, panValue) {
        const freq = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(freq);

        if (!this.frequencyPositions) {
            this.frequencyPositions = [];
        }
        if (this.currentFreqTimeStep === undefined) {
            this.currentFreqTimeStep = 0;
        } else {
            this.currentFreqTimeStep += this.timeVizInc;
        }

        let peakF = Math.max(...freq) || 1;

        const maxHeight = 1;

        for (let i = 0; i < freq.length; i++) {
            const x = panValue*this.currentFreqTimeStep;
            const y = i == 0 ? i : (i/500);
            const z = (freq[i] / peakF);

            this.frequencyPositions.push(x, (y + 0.25), z);

            const dataDensity = 2;
		    const pCol = this.getColor(i, wave.length, dataDensity);
            this.colors.push(pCol[0], pCol[1], pCol[2], 1.0);
        }

        return this.frequencyPositions;
    }


    updateWaveformPositions(analyser, panValue) {
        const wave = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(wave);

        if (!this.waveformPositions) {
            this.waveformPositions = [];
        }
        if (this.currentWaveTimeStep === undefined) {
            this.currentWaveTimeStep = 0;
        } else {
            this.currentWaveTimeStep += this.timeVizInc;
        }

        let peakW = Math.max(...wave) || 1;

        const maxHeight = 1;
        for (let i = 0; i < wave.length; i++) {
            const x = panValue * this.currentWaveTimeStep;
            const y = -1*(wave[i] / peakW) * maxHeight;
            const z = ((wave.length/2) - i)/500;
            this.waveformPositions.push(x, y, z);
            const dataDensity = 2.35;
		    const pCol = this.getColor(i, wave.length, dataDensity);
            this.colors.push(pCol[0], pCol[1], pCol[2], 1.0);
        }

        return  this.waveformPositions;
    }

    getColor(i, l, densityFactor = 1) {
      // Constants to define the speed and complexity of the color cycle
      const frequency = (2 * Math.PI / l) * densityFactor; // Adjust frequency based on data density
        function clampAndRound(value) {
          return Math.min(Math.max(Math.round(value * 100) / 100, 0), 1);
        }
      // Adjust the phase offsets based on data density to enhance color distinction
      const phaseR = densityFactor * 0;
      const phaseG = densityFactor * 2 * Math.PI / 3;
      const phaseB = densityFactor * 4 * Math.PI / 3;

      // Calculate red, green, and blue values based on sine functions
      let r = Math.sin(frequency * i + phaseR) * 0.5 + 0.5;
      let g = Math.sin(frequency * i + phaseG) * 0.5 + 0.5;
      let b = Math.sin(frequency * i + phaseB) * 0.5 + 0.5;

      // Normalize the RGB values to the range [0.0, 1.0]
      r = clampAndRound(r);
      g = clampAndRound(g);
      b = clampAndRound(b);

      return [r, g, b];
    }


    initEventListeners() {
        this.canvas.addEventListener('pointerdown', (e) => this.handleMouseDown(e));
        document.addEventListener('pointerup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('pointermove', (e) => this.handleMouseMove(e));
    }

    handleMouseDown(event) {
        this.isMouseDown = true;
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
    }

    handleMouseUp(event) {
        this.isMouseDown = false;
    }

   handleMouseMove(event) {
        if (!this.isMouseDown) {
            return;
        }
        const deltaX = event.clientX - this.lastMouseX;
        const deltaY = event.clientY - this.lastMouseY;
        this.rotateCamera(deltaX, deltaY);
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
    }

	resetCamera() {
		this.cameraAngleX = -1* Math.PI/4;
		this.cameraAngleY = -1* Math.PI/4;
		this.updateModelViewMatrix();
		    this.draw();
	}

    rotateCamera(deltaX, deltaY) {

        if (this.cameraAngleY) {
            this.cameraAngleY += deltaX * 0.01;
        } else {
            this.cameraAngleY = deltaX * 0.01;
        }
        if (this.cameraAngleX) {
            this.cameraAngleX += deltaY * 0.01;
        } else {
            this.cameraAngleX = deltaY * 0.01;
        }
        this.cameraAngleX = Math.max(Math.min(this.cameraAngleX, Math.PI / 2), -Math.PI / 2);
        this.updateModelViewMatrix();
        this.draw();
    }

    updateModelViewMatrix() {


        let radius = 6;

        let cameraPosX = radius * Math.sin(this.cameraAngleY) * Math.cos(this.cameraAngleX);
        let cameraPosY = radius * Math.sin(this.cameraAngleX);
        let cameraPosZ = radius * Math.cos(this.cameraAngleY) * Math.cos(this.cameraAngleX);

        let cameraPos = [cameraPosX, cameraPosY, cameraPosZ];
        let center = [0, 0, 0];
        let upVector = [0, 1, 0];


        glMatrix.mat4.identity(this.modelViewMatrix);
        glMatrix.mat4.lookAt(this.modelViewMatrix, cameraPos, center, upVector);
    }


}
