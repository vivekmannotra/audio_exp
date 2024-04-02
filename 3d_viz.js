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
	
	this.axesVertices = new Float32Array([
    // X-axis (red)
    -1.0, 0.0, 0.0,
    1.0, 0.0, 0.0,
    // Y-axis (green)
    0.0, -1.0, 0.0,
    0.0, 1.0, 0.0,
    // Z-axis (blue)
    0.0, 0.0, -1.0,
    0.0, 0.0, 1.0
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
  }
`
        this.fragmentShaderSource = `
varying lowp vec4 vColor;
  void main() {
	gl_FragColor = vColor;
  }
`;

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
	this.vertexCount = positions.length / 3;
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);
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

        this.gl.useProgram(this.programInfo.program);
        this.gl.uniformMatrix4fv(this.programInfo.uniformLocations.projectionMatrix, false, this.projectionMatrix);
        this.gl.uniformMatrix4fv(this.programInfo.uniformLocations.modelViewMatrix, false, this.modelViewMatrix);

	this.gl.uniform1i(this.programInfo.uniformLocations.useVertexColor, 0);
	this.gl.uniform4fv(this.programInfo.uniformLocations.defaultColor, [0.0, 0.0, 0.0, 1.0]); 

        this.gl.drawArrays(this.gl.POINTS, 0, this.vertexCount);

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

startVisualizationLoop(analyser, maxIterations = 100) {
    let iterationCount = 0;

    const drawLoop = () => {
        
        if (iterationCount < maxIterations) {
            this.updatePositionsFromAudio(analyser);
        	iterationCount++; 
        	requestAnimationFrame(drawLoop);
        }
  
    };

    requestAnimationFrame(drawLoop); 
}


	updatePositionsFromAudio(analyser) {

	const freq = new Uint8Array(analyser.frequencyBinCount);
	const wave = new Uint8Array(analyser.fftSize);

	analyser.getByteFrequencyData(freq);
	analyser.getByteTimeDomainData(wave);


   let positions = [];
	let peakF = Math.max(...freq);
	let peakW = Math.max(...wave);

const maxHeight = 2; 
    const maxDepth = 1; 
    
    const waveSize = wave.length;
	const freqSize = freq.length;
	const timeStep = 0;
    const wavePointsPerFreq = waveSize / freqSize;

    for (let i = 0; i < freqSize; i++) {
        const x = timeStep; // Time progression
        const y = (freq[i] / peakF) * maxHeight;
        
        let waveSegmentSum = 0;
        for (let j = 0; j < wavePointsPerFreq; j++) {
            const waveIndex = Math.floor(i * wavePointsPerFreq + j);
            waveSegmentSum += wave[waveIndex];
        }
        const z = ((waveSegmentSum / wavePointsPerFreq) / peakW) * maxDepth - (maxDepth / 2);

        positions.push(x, y, z);
    }

freq.forEach((value, index) => { positions.push(-1*index/freq.length);    positions.push(-1*value/peakF);    positions.push(0); }); 
wave.forEach((value, index) => { positions.push(-1*index/wave.length);    positions.push(-1*value/peakW);    positions.push(0); }); 

    this.updatePositions(positions);
    this.draw();
}

    
    initEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
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

    rotateCamera(deltaX, deltaY) {

    if (this.cameraAngleY) { this.cameraAngleY += deltaX * 0.01; } else { this.cameraAngleY = deltaX * 0.01; }
    if (this.cameraAngleX) { this.cameraAngleX += deltaY * 0.01; } else { this.cameraAngleX = deltaY * 0.01; }
    this.cameraAngleX = Math.max(Math.min(this.cameraAngleX, Math.PI / 2), -Math.PI / 2);
    this.updateModelViewMatrix();
    this.draw();
	}

updateModelViewMatrix() {

	
let radius = 10; 

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
