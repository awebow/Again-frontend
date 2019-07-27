varying highp vec2 fragTexCoord;

uniform sampler2D texture;

void main(void) {
    gl_FragColor = texture2D(texture, vec2(fragTexCoord.x, fragTexCoord.y));
}