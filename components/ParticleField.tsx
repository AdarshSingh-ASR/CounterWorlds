"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export function ParticleField() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = host.current;
    if (!container || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
    camera.position.set(0, 2.2, 8.4);
    camera.lookAt(0, -0.7, 0);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.55));
    container.appendChild(renderer.domElement);

    const mobile = window.innerWidth < 680;
    const count = mobile ? 9_000 : 22_000;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      const x = (Math.random() - 0.5) * 14;
      const z = (Math.random() - 0.5) * 7;
      const ridge = Math.exp(-Math.pow(x * 0.22, 2)) * 1.5;
      const wave = Math.sin(x * 0.85 + z * 0.6) * 0.24 + Math.cos(z * 1.35 - x * 0.22) * 0.16;
      positions[index * 3] = x;
      positions[index * 3 + 1] = -1.9 + ridge + wave + Math.random() * 0.08;
      positions[index * 3 + 2] = z;
      seeds[index] = Math.random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() } },
      vertexShader: `
        uniform float uTime; uniform float uPixelRatio; attribute float aSeed; varying float vAlpha;
        void main(){ vec3 p=position; p.y += sin(p.x*.7 + uTime*.38 + aSeed*6.283)*.045; p.z += sin(p.x*.32+uTime*.18)*.035;
          vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
          gl_PointSize=(1.2+aSeed*1.8)*uPixelRatio*(7.0/-mv.z); vAlpha=.28+aSeed*.72; }
      `,
      fragmentShader: `
        varying float vAlpha; void main(){ float d=distance(gl_PointCoord,vec2(.5)); if(d>.5) discard;
          float glow=smoothstep(.5,0.,d); gl_FragColor=vec4(.58,1.,.08,glow*vAlpha); }
      `,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);
    const startedAt = performance.now();
    let frame = 0;
    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    const animate = () => {
      material.uniforms.uTime.value = (performance.now() - startedAt) / 1000;
      points.rotation.y = Math.sin(material.uniforms.uTime.value * 0.08) * 0.035;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} className="particle-field" aria-hidden="true"><div className="particle-static" /></div>;
}
