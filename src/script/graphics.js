import { mat4 } from "gl-matrix";
import axios from "axios";

/**
 * 셰이더 소스를 컴파일하여 쉐이더를 생성한다.
 * @param {WebGLRenderingContext} gl WebGl 렌더링 Context.
 * @param {*} type 셰이더 타입(VERTEX_SHADER/FRAGMNET_SHADER).
 * @param {*} src 셰이더 소스.
 */
function createShader(gl, type, src) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.log(gl.getShaderInfoLog(shader));
        return null;  
    }

    return shader;
}

/**
 * WebGL 사용을 위한 Wrapper 클래스.
 */
export class Graphics {

    /**
     * @param {HTMLCanvasElement} canvas Canvas 요소.
     */
    constructor(canvas) {
        // 캔버스 초기화
        this.gl = canvas.getContext('webgl') || canvas.getContext("experimental-webgl");;
        this.gl.viewport(0, 0, canvas.width, canvas.height);

        this.render = function(deltaTime) {}; // 렌더링 메소드
        this.lastRendered = 0; // 마지막 렌더링 Timestamp

        this.plane = this.gl.createBuffer(); // 평면 Vertex Array
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.plane);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
            1, 0, 0,
            1, 1, 0,
            0, 0, 0,
            0, 1, 0
        ]), this.gl.STATIC_DRAW);

        this.planeTexCoord = this.gl.createBuffer(); // 평면 텍스쳐 좌표 Array
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.planeTexCoord);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
            1, 0,
            1, 1,
            0, 0,
            0, 1
        ]), this.gl.STATIC_DRAW);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);

        this.camera = { // 카메라 설정
            center: {
                x: 0.5,
                y: 0.5
            },
            width: 1,
            height: 1
        };

        this.projection = mat4.create(); // Projection 행렬
        mat4.ortho(this.projection, -0.5, 0.5, -0.5, 0.5, -1, 1);

        this.view = mat4.create(); // View 행렬
        mat4.lookAt(this.view, [0.5, 0.5, 1], [0.5, 0.5, 0], [0, 1, 0]);

        this.model = mat4.create(); // Model 행렬
        this.modelView = mat4.create(); // Model View 행렬
    }

    /**
     * 초기화 작업. 인스턴스 생성 후 사용하기 전에 한 번 실행해야 합니다.
     * 비동기로 처리해야하는 작업은 이 메소드에서 수행합니다.
     */
    async init() {
        var vertexSrc = (await axios.get('/shaders/texture_vs.glsl')).data;
        var fragmentSrc = (await axios.get('/shaders/texture_fs.glsl')).data;
        this.textureShader = this.createProgram(vertexSrc, fragmentSrc);
        this.textureLoc = this.gl.getUniformLocation(this.textureShader, "texture");

        this.vertexPosAttr = this.gl.getAttribLocation(this.textureShader, "vertexPos");
        this.gl.enableVertexAttribArray(this.vertexPosAttr);

        this.textureCoordAttr = this.gl.getAttribLocation(this.textureShader, "textureCoord");
        this.gl.enableVertexAttribArray(this.textureCoordAttr);

        this.modelViewLoc = this.gl.getUniformLocation(this.textureShader, 'modelView');
        this.projectionLoc = this.gl.getUniformLocation(this.textureShader, 'projection');
    }

    /**
     * 렌더 루프 시작.
     */
    start() {
        this.lastRendered = Date.now();
        this.loop();
    }

    /**
     * 렌더 루프.
     */
    loop() {
        var now = Date.now();
        this.render((now - this.lastRendered) / 1000);
        this.lastRendered = now;

        window.setTimeout(() => this.loop(), 1000 / 60);
    }

    /**
     * 셰이더 프로그램 생성.
     * @param {String} vertexSrc Vertex 셰이더 소스.
     * @param {String} fragmentSrc Fragment 셰이더 소스.
     */
    createProgram(vertexSrc, fragmentSrc) {
        var vertexShader = createShader(this.gl, this.gl.VERTEX_SHADER, vertexSrc);
        var fragmentShader = createShader(this.gl, this.gl.FRAGMENT_SHADER, fragmentSrc);

        if(vertexShader == null || fragmentShader == null) {
            return null;
        }

        var program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);

        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.log("Unable to initialize the shader program.");
        }

        return program;
    }

    /**
     * 텍스쳐 로드.
     * @param {String} src 이미지 URL.
     */
    loadTexture(src) {
        let texture = this.gl.createTexture();
        return new Promise((resolve, reject) => {
            let image = new Image();

            let self = this;
            image.onload = function() {
                self.gl.bindTexture(self.gl.TEXTURE_2D, texture);
                self.gl.texImage2D(self.gl.TEXTURE_2D, 0, self.gl.RGBA, self.gl.RGBA, self.gl.UNSIGNED_BYTE, image);
                self.gl.texParameteri(self.gl.TEXTURE_2D, self.gl.TEXTURE_WRAP_S, self.gl.CLAMP_TO_EDGE);
                self.gl.texParameteri(self.gl.TEXTURE_2D, self.gl.TEXTURE_WRAP_T, self.gl.CLAMP_TO_EDGE);
                self.gl.texParameteri(self.gl.TEXTURE_2D, self.gl.TEXTURE_MAG_FILTER, self.gl.LINEAR);
                self.gl.texParameteri(self.gl.TEXTURE_2D, self.gl.TEXTURE_MIN_FILTER, self.gl.LINEAR);
                self.gl.bindTexture(self.gl.TEXTURE_2D, null);

                resolve(texture);
            };
            image.src = src;
        });
    }

    /**
     * 카메라 설정.
     * @param {Number} centerX 카메라 중심 X 좌표.
     * @param {Number} centerY 카메라 중심 Y 좌표.
     * @param {Number} width 카메라 가로 크기.
     * @param {Number} height 카메라 세로 크기.
     */
    setCamera(centerX, centerY, width, height) {
        this.camera.center.x = centerX;
        this.camera.center.y = centerY;
        this.camera.width = width;
        this.camera.height = height;

        this.updateCamera();
    }

    /**
     * 카메라 갱신.
     */
    updateCamera() {
        var halfWidth = this.camera.width / 2;
        var halfHeight = this.camera.height / 2;
        mat4.ortho(this.projection, -halfWidth, halfWidth, -halfHeight, halfHeight, -1, 1);
        mat4.lookAt(this.view,
            [this.camera.center.x, this.camera.center.y, 1],
            [this.camera.center.x, this.camera.center.y, 0], [0, 1, 0]);
    }

    /**
     * 텍스쳐 그리기.
     * @param {*} texture 텍스쳐.
     * @param {Number} x X 좌표.
     * @param {Number} y Y 좌표.
     * @param {Number} width 가로 크기.
     * @param {Number} height 세로 크기.
     * @param {Number} rotation 회전 각도.
     */
    drawTexture(texture, x, y, width, height, rotation=0) {
        // 셰이더 프로그램을 텍스쳐 셰이더로 설정.
        this.gl.useProgram(this.textureShader);

        // Boundary에 맞춰 Transform 행렬 생성.
        var transform = mat4.create();
        mat4.translate(transform, this.model, [x, y, 0]);
        mat4.translate(transform, transform, [width / 2, height / 2, 0]);
        mat4.rotateZ(transform, transform, rotation);
        mat4.translate(transform, transform, [-width / 2, -height / 2, 0]);
        mat4.scale(transform, transform, [width, height, 1]);

        // Model View 행렬 계산.
        mat4.multiply(this.modelView, this.view, transform);

        // MVP 행렬 설정.
        this.gl.uniformMatrix4fv(this.projectionLoc, false, new Float32Array(this.projection));
        this.gl.uniformMatrix4fv(this.modelViewLoc, false, new Float32Array(this.modelView));

        // 평면 Vertex Array를 셰이더에 입력.
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.plane);
        this.gl.vertexAttribPointer(this.vertexPosAttr, 3, this.gl.FLOAT, false, 0, 0);

        // 평면 텍스쳐 좌표 Array를 셰이더에 입력.
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.planeTexCoord);
        this.gl.vertexAttribPointer(this.textureCoordAttr, 2, this.gl.FLOAT, false, 0, 0);

        // 텍스쳐 입력
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.uniform1i(this.textureLoc, 0);

        // 입력된 정점 배열을 화면에 그린다.
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

        // 셰이더 설정 해제.
        this.gl.useProgram(null);
    }

}

/**
 * draw() 메소드를 통해 화면에 그릴 수 있는 요소.
 */
export class Drawable {

    /**
     * Drawable 생성.
     * @param {Graphics} graphics Graphics 인스턴스.
     */
    constructor(graphics) {
        this.graphics = graphics;
    }

    /**
     * Drawable을 화면에 그린다.
     */
    draw() {}

}

/**
 * 위치, 크기, 회전을 통해 그려지는 텍스쳐.
 */
export class Sprite extends Drawable {

    /**
     * Sprite 생성.
     * @param {Graphics} graphics Graphics 인스턴스.
     * @param {*} texture 텍스쳐.
     */
    constructor(graphics, texture) {
        super(graphics);
        this.texture = texture;

        this.x = 0;
        this.y = 0;
        this.width = 1;
        this.height = 1;
        this.rotation = 0;
    }

    draw() {
        this.graphics.drawTexture(this.texture, this.x, this.y, this.width, this.height, this.rotation);
    }

    /**
     * 중심 좌표 설정.
     * @param {Number} x 
     * @param {Number} y 
     */
    setCenter(x, y) {
        this.x = x - this.width / 2;
        this.y = y - this.height / 2;
    }

    /**
     * 중심 X 좌표 설정.
     * @param {Number} x 
     */
    setCenterX(x) {
        this.x = x - this.width / 2;
    }

    /**
     * 중심 Y 좌표 설정
     * @param {Number} y 
     */
    setCenterY(y) {
        this.y = y - this.height / 2;
    }

}

/**
 * 특정 Transform 행렬이 적용되는 Drawable의 그룹.
 */
export class LocalGroup extends Drawable {

    /**
     * LocalGroup 생성.
     * @param {Graphics} graphics 
     */
    constructor(graphics) {
        super(graphics);

        this.drawables = [];

        this.translation = {
            x: 0,
            y: 0
        };

        this.scale = {
            x: 1,
            y: 1
        };

        this.rotation = 0;
    }

    draw() {
        var transform = mat4.create();
        mat4.translate(transform, this.graphics.model, [this.translation.x, this.translation.y, 0]);
        mat4.rotateZ(transform, transform, this.rotation);
        mat4.scale(transform, transform, [this.scale.x, this.scale.y, 1]);

        var model = this.graphics.model;
        this.graphics.model = transform;

        for(let drawable of this.drawables) {
            drawable.draw();
        }

        this.graphics.model = model;
    }

}