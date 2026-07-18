(() => {
  const root = document.documentElement;
  const videos = [...document.querySelectorAll('.stage-video')];
  const surfaces = [...document.querySelectorAll('.glass-surface')]
    .map((surface) => ({ surface, canvas: surface.querySelector(':scope > .glass-refractor') }))
    .filter(({ canvas }) => canvas);

  if (!surfaces.length || !videos.length) return;

  const vertexSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;

    void main() {
      v_uv = a_position * .5 + .5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentSource = `
    precision highp float;

    varying vec2 v_uv;
    uniform sampler2D u_video;
    uniform vec2 u_viewport;
    uniform vec2 u_videoSize;
    uniform vec4 u_rect;
    uniform float u_open;
    uniform float u_dark;

    vec2 videoUV(vec2 screenPoint) {
      float scale = max(u_viewport.x / u_videoSize.x, u_viewport.y / u_videoSize.y);
      vec2 displaySize = u_videoSize * scale;
      vec2 crop = (displaySize - u_viewport) * .5;
      vec2 uv = (screenPoint + crop) / displaySize;
      return vec2(uv.x, 1.0 - uv.y);
    }

    vec4 softenedSample(vec2 uv, vec2 px, float radius) {
      vec4 color = texture2D(u_video, uv) * .28;
      color += texture2D(u_video, uv + vec2(px.x, 0.0) * radius) * .12;
      color += texture2D(u_video, uv - vec2(px.x, 0.0) * radius) * .12;
      color += texture2D(u_video, uv + vec2(0.0, px.y) * radius) * .12;
      color += texture2D(u_video, uv - vec2(0.0, px.y) * radius) * .12;
      color += texture2D(u_video, uv + px * radius) * .06;
      color += texture2D(u_video, uv - px * radius) * .06;
      color += texture2D(u_video, uv + vec2(px.x, -px.y) * radius) * .06;
      color += texture2D(u_video, uv + vec2(-px.x, px.y) * radius) * .06;
      return color;
    }

    void main() {
      vec2 centered = v_uv - .5;
      vec2 edgeDistance = min(v_uv, 1.0 - v_uv);
      vec2 wallLens = 1.0 - smoothstep(vec2(.012), vec2(.07), edgeDistance);
      float edgeLens = max(wallLens.x, wallLens.y);
      vec2 lensNormal = normalize(
        vec2(sign(centered.x) * wallLens.x, -sign(centered.y) * wallLens.y) + vec2(.0001)
      );

      vec2 screenPoint = vec2(
        u_rect.x + v_uv.x * u_rect.z,
        u_rect.y + (1.0 - v_uv.y) * u_rect.w
      );

      /* A web adaptation of the thicker Apple material: the body slightly
         magnifies the scene while the rim bends it much more strongly. */
      vec2 bodyShift = vec2(centered.x * u_rect.z, -centered.y * u_rect.w)
        * mix(.0015, .003, u_open);
      float edgeStrength = mix(5.0, 9.0, u_open);
      screenPoint -= bodyShift + lensNormal * edgeLens * edgeStrength;

      float scale = max(u_viewport.x / u_videoSize.x, u_viewport.y / u_videoSize.y);
      vec2 displaySize = u_videoSize * scale;
      vec2 px = 1.0 / displaySize;
      vec2 uv = videoUV(screenPoint);
      float blurRadius = mix(3.4, 5.4, u_open) + edgeLens * .8;
      vec4 color = softenedSample(uv, px, blurRadius);

      /* Keep people and brand photography chromatically intact. The glass
         bends luminance at its rim, but never splits skin tones into RGB. */

      float topLight = (1.0 - smoothstep(.0, .085, 1.0 - v_uv.y)) * .16;
      float leftLight = (1.0 - smoothstep(.0, .07, v_uv.x)) * .07;
      float bottomShade = (1.0 - smoothstep(.0, .09, v_uv.y)) * .07;
      color.rgb += edgeLens * .025 + topLight + leftLight - bottomShade;
      color.rgb = (color.rgb - .5) * 1.045 + .5;

      /* Adapt density gently: strong per-pixel correction turns faces into
         cut-out silhouettes. A mostly even veil keeps skin and photography
         coherent while still responding to the scene and appearance. */
      float luminance = dot(color.rgb, vec3(.2126, .7152, .0722));
      float lightDensity = mix(.22, .42, u_open) + (1.0 - luminance) * .04;
      float darkDensity = mix(.24, .44, u_open) + luminance * .035;
      vec3 lightMaterial = mix(color.rgb, vec3(.965, .97, .985), lightDensity);
      vec3 darkMaterial = mix(color.rgb, vec3(.018, .022, .034), darkDensity);
      color.rgb = mix(lightMaterial, darkMaterial, u_dark);
      gl_FragColor = vec4(color.rgb, 1.0);
    }
  `;

  function createRenderer(surface, canvas) {
    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      surface.dataset.glassRenderer = 'fallback';
      return null;
    }

    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) || 'Glass shader compilation failed.');
      }

      return shader;
    }

    let program;

    try {
      program = gl.createProgram();
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || 'Glass shader linking failed.');
      }
    } catch (error) {
      console.warn(error);
      surface.dataset.glassRenderer = 'fallback';
      return null;
    }

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1,
    ]), gl.STATIC_DRAW);

    gl.useProgram(program);
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      video: gl.getUniformLocation(program, 'u_video'),
      viewport: gl.getUniformLocation(program, 'u_viewport'),
      videoSize: gl.getUniformLocation(program, 'u_videoSize'),
      rect: gl.getUniformLocation(program, 'u_rect'),
      open: gl.getUniformLocation(program, 'u_open'),
      dark: gl.getUniformLocation(program, 'u_dark'),
    };

    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.uniform1i(uniforms.video, 0);
    gl.clearColor(0, 0, 0, 0);

    function resize(rect) {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.35);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));

      if (canvas.width === width && canvas.height === height) return;

      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }

    function draw(video, rect) {
      resize(rect);

      try {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      } catch {
        surface.dataset.glassRenderer = 'fallback';
        return false;
      }

      const expanded = surface.classList.contains('is-open') || surface.classList.contains('glass-surface--expanded');
      gl.useProgram(program);
      gl.uniform2f(uniforms.viewport, window.innerWidth, window.innerHeight);
      gl.uniform2f(uniforms.videoSize, video.videoWidth, video.videoHeight);
      gl.uniform4f(uniforms.rect, rect.left, rect.top, rect.width, rect.height);
      gl.uniform1f(uniforms.open, expanded ? 1 : 0);
      gl.uniform1f(uniforms.dark, root.dataset.theme === 'dark' ? 1 : 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      surface.dataset.glassRenderer = 'webgl';
      return true;
    }

    return { surface, draw };
  }

  const renderers = surfaces
    .map(({ surface, canvas }) => createRenderer(surface, canvas))
    .filter(Boolean);

  if (!renderers.length) {
    root.dataset.glassRenderer = 'fallback';
    return;
  }

  let lastFrame = 0;

  function activeVideo() {
    return videos.find((video) => getComputedStyle(video).display !== 'none') || videos[0];
  }

  function draw(time) {
    requestAnimationFrame(draw);

    if (
      document.hidden
      || root.dataset.reduceMotion === 'true'
      || root.dataset.reduceTransparency === 'true'
      || time - lastFrame < 32
    ) return;

    const video = activeVideo();
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) return;

    lastFrame = time;
    let rendered = false;

    renderers.forEach((renderer) => {
      if (renderer.surface.hidden) return;

      const rect = renderer.surface.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2 || rect.bottom < 0 || rect.top > window.innerHeight) return;

      rendered = renderer.draw(video, rect) || rendered;
    });

    root.dataset.glassRenderer = rendered ? 'webgl' : root.dataset.glassRenderer || 'fallback';
  }

  requestAnimationFrame(draw);
})();
