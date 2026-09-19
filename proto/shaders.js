// CoreThree — hero shader prototype. Raw WebGL1, без зависимостей.
// Три ядра = три источника света с разной фазой дыхания.

export const VERT = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

// --- общая голова: шум + fbm. OCT подставляется из JS (WebGL1 требует константу в цикле)
const NOISE = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x  = 2.0 * fract(p * C.www) - 1.0;
    vec3 h  = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

float fbm(vec2 x) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < OCT; ++i) {
        v += a * snoise(x);
        x = rot * x * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}
`;

// --- проход симуляции: след курсора живёт в отдельной текстуре (RGBA8, поэтому кодируем)
export const SIM_FRAG = `
precision highp float;
uniform sampler2D uPrev;
uniform vec2  uPointer;     // uv поля
uniform vec2  uPointerVel;  // в единицах uv/сек
uniform float uInject;      // 1 пока курсор движется
uniform float uDt;
uniform vec2  uTexel;
uniform float uAspect;
uniform float uDecay;       // скорость оседания
uniform float uCurl;        // сила завихрения

vec3 decode(vec4 c) { return vec3((c.rg - 0.5) * 2.0, c.b); }
vec4 encode(vec2 v, float ink) {
    return vec4(clamp(v * 0.5 + 0.5, 0.0, 1.0), clamp(ink, 0.0, 1.0), 1.0);
}

void main() {
    vec2 uv = gl_FragCoord.xy * uTexel;
    vec3 here = decode(texture2D(uPrev, uv));

    // поток сносит сам себя: читаем оттуда, откуда пришёл
    vec3 prev = decode(texture2D(uPrev, uv - here.xy * uDt * 0.9));

    // соседи дают локальную завихренность
    vec3 l = decode(texture2D(uPrev, uv - vec2(uTexel.x, 0.0)));
    vec3 r = decode(texture2D(uPrev, uv + vec2(uTexel.x, 0.0)));
    vec3 d = decode(texture2D(uPrev, uv - vec2(0.0, uTexel.y)));
    vec3 u = decode(texture2D(uPrev, uv + vec2(0.0, uTexel.y)));
    float curl = (r.y - l.y) - (u.x - d.x);

    vec2  vel = prev.xy + vec2(-prev.y, prev.x) * curl * uCurl * uDt;
    float ink = prev.z;

    vel *= exp(-uDt * uDecay);
    ink *= exp(-uDt * (uDecay * 0.8));

    // курсор впрыскивает круглый сплэт, несущий свою скорость
    vec2  dpx = (uv - uPointer) * vec2(uAspect, 1.0);
    float g   = exp(-dot(dpx, dpx) / 0.0028);
    vel += uPointerVel * g * uInject;
    ink += length(uPointerVel) * 0.7 * uInject * g;

    if (length(vel) < 0.006) vel = vec2(0.0);
    if (ink < 0.004) ink = 0.0;

    gl_FragColor = encode(vel, ink);
}
`;

// --- проход отрисовки: шёлк
export const SILK_FRAG = `precision highp float;
` + NOISE + `
uniform vec2  uResolution;
uniform float uTime;
uniform vec2  uMouse;       // в тех же координатах, что p
uniform float uPointerVel;
uniform float uScroll;
uniform float uVelocity;
uniform sampler2D uField;

uniform float uScale;
uniform float uWarp;
uniform float uFlow;
uniform float uExposure;
uniform float uSheen;
uniform float uGlint;
uniform float uFresnel;
uniform float uFilm;
uniform float uEdge;
uniform float uGrain;
uniform float uVignette;
uniform float uSpeed;
uniform vec3  uAccent;
uniform vec3  uCoreW;       // вес каждого из трёх ядер
uniform float uMode;        // 0 — тёмный шёлк, 1 — молочный

vec3 readField(vec2 at) {
    vec4 c = texture2D(uField, at);
    return vec3((c.rg - 0.5) * 2.0, c.b);
}

void addCore(vec3 n, float t, float speed, float phase, float height, float wgt,
             inout float diff, inout float sheen, inout float glint) {
    vec3 L = normalize(vec3(
        0.55 * cos(t * speed + phase) + uMouse.x * 0.25,
        0.45 * sin(t * speed * 0.8 + phase) + uMouse.y * 0.25 + height,
        0.85));
    vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
    float ndl = max(dot(n, L), 0.0);
    float ndh = max(dot(n, H), 0.0);
    // ядра дышат с разной фазой — поверхность никогда не выглядит зацикленной
    float breath = 0.78 + 0.22 * sin(t * speed * 3.0 + phase);
    diff  += ndl * wgt * breath;
    sheen += pow(ndh, 9.0) * 0.14 * wgt * breath;
    glint += pow(ndh, 72.0) * 0.32 * wgt * breath;
}

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    vec2 p  = uv * 2.0 - 1.0;
    p.x *= uResolution.x / uResolution.y;
    p *= uScale;

    float t = uTime * 0.15 * uSpeed;

    vec3  field = readField(uv);
    vec2  flow  = field.xy;
    float stir  = field.z;

    float dist = length(p - uMouse);
    float pull = exp(-dist * 1.5) * (0.5 + uPointerVel * 0.55);

    // двойное искажение области: складки шёлка
    vec2 q = vec2(fbm(p), fbm(p + vec2(1.0)));
    vec2 r;
    r.x = fbm(p + uWarp * q + vec2(1.7, 9.2) + 0.150 * t + uMouse.x * pull);
    r.y = fbm(p + uWarp * q + vec2(8.3, 2.8) + 0.126 * t + uMouse.y * pull);

    vec2 w = p + r + uScroll * 0.2 + flow * uFlow + stir * 0.4 * vec2(r.y, -r.x);
    float f = fbm(w);

    // рельеф: наклон последнего слоя, искажение при этом держим неподвижным
    float e  = 0.07;
    float fx = fbm(w + vec2(e, 0.0));
    float fy = fbm(w + vec2(0.0, e));
    vec3  n  = normalize(vec3(-(fx - f) / e * 0.16, -(fy - f) / e * 0.16, 1.0));

    float ndv  = max(dot(n, vec3(0.0, 0.0, 1.0)), 0.0);
    float fres = pow(1.0 - ndv, 3.2);

    float diff = 0.0, sheen = 0.0, glint = 0.0;
    addCore(n, t, 0.110, 0.00, 0.35, uCoreW.x, diff, sheen, glint);
    addCore(n, t, 0.070, 2.09, 0.30, uCoreW.y, diff, sheen, glint);
    addCore(n, t, 0.050, 4.18, 0.40, uCoreW.z, diff, sheen, glint);
    float wsum = max(uCoreW.x + uCoreW.y + uCoreW.z, 0.001);
    diff /= wsum;

    // свет живёт на гребнях складок
    float crest = clamp(length(q) * length(r) * f * 1.6, 0.0, 1.0);

    // палитры двух тем смешиваются одной переменной: геометрия общая
    vec3 base = mix(vec3(0.014, 0.016, 0.026), vec3(0.963, 0.968, 0.978), uMode);
    vec3 mid  = mix(vec3(0.048, 0.070, 0.116), vec3(0.792, 0.822, 0.884), uMode);
    vec3 high = mix(uAccent * 0.95,            mix(uAccent, vec3(1.0), 0.55), uMode);
    vec3 bg   = mix(vec3(0.0), vec3(0.957, 0.961, 0.969), uMode);

    float diffW  = mix(0.22, 0.12, uMode);
    float specW  = mix(1.00, 0.45, uMode);
    float filmW  = mix(1.00, 0.55, uMode);

    vec3 albedo = mix(base, mid, clamp(f * f * 4.0, 0.0, 1.0));
    albedo = mix(albedo, high, clamp(length(q) * length(r) * f, 0.0, 1.0) * (0.6 + pull * 0.4));
    vec3 color = albedo * ((1.0 - diffW) + diffW * diff);

    // тонкая плёнка: оптический путь растёт с высотой складки и углом взгляда
    float path = (f * 0.5 + 0.5) * 2.2 + (1.0 - ndv) * 1.6;
    vec3  film = 0.5 + 0.5 * cos(6.28318 * (path + vec3(0.0, 0.33, 0.67)));
    film = mix(vec3(dot(film, vec3(0.3333))), film, 0.4);
    film = mix(film, high * 1.6, 0.5);

    color += film * uFilm * filmW
           * (fres * 0.16 * uFresnel + sheen * uSheen + glint * 0.7 * uGlint) * specW
           * (0.45 + 0.55 * crest) * (0.75 + uVelocity * 0.08);
    color += high * glint * 0.45 * crest * uGlint * specW;

    // линии сгиба
    float edge = smoothstep(0.40, 0.50, f) - smoothstep(0.50, 0.60, f);
    color += mix(vec3(0.20, 0.30, 0.40), -vec3(0.10, 0.12, 0.16), uMode)
           * edge * uEdge * (0.35 + uVelocity * 0.1);

    // виньетка и растворение к краю кадра
    float v = smoothstep(2.5, 0.1, length(p));
    color = mix(color, color * (0.4 + 0.6 * v), uVignette);

    color = pow(max(color, 0.0), vec3(0.97)) * uExposure + 0.004;

    float bottomFade = smoothstep(0.0, 0.2, uv.y);
    color = mix(bg, color, bottomFade);

    // дизеринг, чтобы тёмные градиенты не полосили
    float ign = fract(52.9829189 * fract(0.06711056 * gl_FragCoord.x + 0.00583715 * gl_FragCoord.y));
    color += (ign - 0.5) * uGrain / 255.0;

    gl_FragColor = vec4(color, 1.0);
}
`;
