import { mat4 } from 'gl-matrix';
//@ts-ignore
import vsSource from './shaders/shader.vert';
//@ts-ignore
import fsSource from './shaders/shader.frag';

interface ProgramInfo {
	program: WebGLProgram,
	attribLocations: Record<'vertexPosition' | 'vertexColor', number>,
	uniformLocations: Record<'projectionMatrix' | 'modelViewMatrix', WebGLUniformLocation | null>,
};

type Buffers = Record<'position' | 'color' | 'indices', WebGLBuffer>

let then = 0;
let cubeRotation = 0;

function getCanvasElement(query: string | WebGL2RenderingContext): HTMLCanvasElement {
	if (typeof query === "string") {

		const element = document.querySelector(query);

		if (!(element instanceof HTMLCanvasElement)) {
			throw Error("Failed to get Canvas Element");
		}

		return element;
	} else {
		const element = query.canvas;
		if (!(element instanceof HTMLCanvasElement)) {
			throw new Error("Not a canvas");
		};
		return element;
	}
}

function loadShader(gl: WebGL2RenderingContext, type: number, source: string) {
	const shader = (() => {
		const shader = gl.createShader(type);
		if (!shader) {
			throw new Error("Failed to create shader");
		}
		return shader;
	})()
	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const log = gl.getShaderInfoLog(shader);
		gl.deleteShader(shader);
		throw new Error(`Failed to compile shader with error ${log}`);
	}
	return shader;
}

function initShaderProgram(gl: WebGL2RenderingContext) {
	const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
	const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

	const shaderProgram = (() => {
		const shaderProgram = gl.createProgram();
		if (!shaderProgram) {
			throw Error("Failed to create program");
		}
		return shaderProgram;
	})()

	gl.attachShader(shaderProgram, vertexShader);
	gl.attachShader(shaderProgram, fragmentShader);
	gl.linkProgram(shaderProgram);

	if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
		const log = gl.getProgramInfoLog(shaderProgram);
		throw new Error(`Failed to initialize the shader program: ${log}`);
	}
	return shaderProgram;
}

function createBuffer(gl: WebGL2RenderingContext) {
	const buffer = gl.createBuffer();
	if (!buffer) {
		throw new Error("Failed to create buffer");
	}
	return buffer;
}

function initBuffers(gl: WebGL2RenderingContext) {
	const positionBuffer = createBuffer(gl);
	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

	const positions = [
		// Front face
		-1.0, -1.0, 1.0,
		1.0, -1.0, 1.0,
		1.0, 1.0, 1.0,
		-1.0, 1.0, 1.0,

		// Back face
		-1.0, -1.0, -1.0,
		-1.0, 1.0, -1.0,
		1.0, 1.0, -1.0,
		1.0, -1.0, -1.0,

		// Top face
		-1.0, 1.0, -1.0,
		-1.0, 1.0, 1.0,
		1.0, 1.0, 1.0,
		1.0, 1.0, -1.0,

		// Bottom face
		-1.0, -1.0, -1.0,
		1.0, -1.0, -1.0,
		1.0, -1.0, 1.0,
		-1.0, -1.0, 1.0,

		// Right face
		1.0, -1.0, -1.0,
		1.0, 1.0, -1.0,
		1.0, 1.0, 1.0,
		1.0, -1.0, 1.0,

		// Left face
		-1.0, -1.0, -1.0,
		-1.0, -1.0, 1.0,
		-1.0, 1.0, 1.0,
		-1.0, 1.0, -1.0,
	];

	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

	const faceColors = [
		[1.0, 1.0, 1.0, 1.0],
		[1.0, 0.0, 0.0, 1.0],
		[0.0, 1.0, 0.0, 1.0],
		[0.0, 0.0, 1.0, 1.0],
		[1.0, 1.0, 0.0, 1.0],
		[1.0, 0.0, 1.0, 1.0]
	];

	let colors: Array<number> = [];
	for (let j = 0; j < faceColors.length; j++) {
		const c = faceColors[j];
		colors = colors.concat(c, c, c, c);
	}

	const colorBuffer = createBuffer(gl);
	gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

	const indexBuffer = createBuffer(gl);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

	const indices = [
		0, 1, 2, 0, 2, 3,
		4, 5, 6, 4, 6, 7,
		8, 9, 10, 8, 10, 11,
		12, 13, 14, 12, 14, 15,
		16, 17, 18, 16, 18, 19,
		20, 21, 22, 20, 22, 23
	];

	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

	return {
		position: positionBuffer,
		color: colorBuffer,
		indices: indexBuffer,
	}
}

function drawScene(gl: WebGL2RenderingContext, programInfo: ProgramInfo, buffers: Buffers, deltaTime: number): void {
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	gl.clearDepth(1.0);
	gl.enable(gl.DEPTH_TEST);
	gl.depthFunc(gl.LEQUAL);

	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	const projectionMatrix = (() => {
		const fov = 45 * Math.PI / 180;
		const canvas = getCanvasElement(gl);
		const aspect = canvas.clientWidth / canvas.clientHeight;
		const zNear = 0.1;
		const zFar = 100.0;
		const projectionMatrix = mat4.create();

		mat4.perspective(projectionMatrix, fov, aspect, zNear, zFar);
		return projectionMatrix;
	})()

	const modelViewMatrix = mat4.create();
	mat4.translate(modelViewMatrix, modelViewMatrix, [-0.0, 0.0, -6.0]);
	mat4.rotate(modelViewMatrix, modelViewMatrix, cubeRotation, [0, 0, 1]);
	mat4.rotate(modelViewMatrix, modelViewMatrix, cubeRotation * .7, [0, 1, 0]);

	{
		const numComponents = 3;
		const type = gl.FLOAT;
		const normalize = false;
		const stride = 0;
		const offset = 0;

		gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
		gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, numComponents, type, normalize, stride, offset);
		gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
	}

	{
		const numComponents = 4;
		const type = gl.FLOAT;
		const normalize = false;
		const stride = 0;
		const offset = 0;
		gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
		gl.vertexAttribPointer(programInfo.attribLocations.vertexColor, numComponents, type, normalize, stride, offset);
		gl.enableVertexAttribArray(programInfo.attribLocations.vertexColor);
	}

	gl.useProgram(programInfo.program);

	gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
	gl.uniformMatrix4fv(programInfo.uniformLocations.modelViewMatrix, false, modelViewMatrix);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
	{
		const vertexCount = 36;
		const type = gl.UNSIGNED_SHORT;
		const offset = 0;
		gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
	}

	cubeRotation += deltaTime;
}


function init() {
	const element = getCanvasElement("#webgl-canvas");
	const gl = (() => {
		const gl = element.getContext('webgl2');
		if (gl === null) {
			throw Error("Failed to get canvas context");
		}
		return gl;
	})()

	const shaderProgram = initShaderProgram(gl);
	const programInfo: ProgramInfo = {
		program: shaderProgram,
		attribLocations: {
			vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
			vertexColor: gl.getAttribLocation(shaderProgram, 'aVertexColor'),
		},
		uniformLocations: {
			projectionMatrix: gl.getUniformLocation(shaderProgram, "uProjectionMatrix"),
			modelViewMatrix: gl.getUniformLocation(shaderProgram, "uModelViewMatrix"),
		},
	};

	const buffers: Buffers = initBuffers(gl);

	function render(now: number) {
		now *= 0.001;
		const deltaTime = now - then;
		then = now;

		drawScene(gl, programInfo, buffers, deltaTime);
		
		requestAnimationFrame(render);
	}

	requestAnimationFrame(render);
}

window.addEventListener("load", init);
