attribute vec3 vertexPos;
attribute vec2 textureCoord;

uniform mat4 modelView;
uniform mat4 projection;

varying highp vec2 fragTexCoord;

void main(void) {
    gl_Position = projection * modelView * vec4(vertexPos, 1.0);
    fragTexCoord = vec2(textureCoord.x, 1.0 - textureCoord.y);
}