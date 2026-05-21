"use client";

import { useEffect, useRef, useState } from "react";
import { sound } from "@/lib/audio";

interface SystemVisualizerProps {
  flat?: boolean;
}

export function SystemVisualizer({ flat = false }: SystemVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState(false);
  const [cardHovered, setCardHovered] = useState(false);
  
  const [metrics, setMetrics] = useState({
    decibels: 30,
    flux: 92.4,
    frequency: 8.5,
  });

  const isActive = hovered || cardHovered;

  // Listen to global card hover events
  useEffect(() => {
    const handleOscilloscopeActive = (e: Event) => {
      const customEvent = e as CustomEvent<{ active: boolean }>;
      setCardHovered(!!customEvent.detail?.active);
    };

    window.addEventListener("oscilloscope-active", handleOscilloscopeActive);
    return () => {
      window.removeEventListener("oscilloscope-active", handleOscilloscopeActive);
    };
  }, []);

  // Update telemetry stats based on activity state
  useEffect(() => {
    const intervalTime = isActive ? 150 : 2000;
    const updateMetrics = () => {
      setMetrics({
        decibels: isActive
          ? Math.floor(45 + Math.random() * 20)
          : Math.floor(30 + Math.random() * 5),
        flux: parseFloat(
          (isActive ? 95 + Math.random() * 4.9 : 91 + Math.random() * 2.5).toFixed(1)
        ),
        frequency: parseFloat(
          (isActive ? 12 + Math.random() * 25 : 6 + Math.random() * 4).toFixed(1)
        ),
      });
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, intervalTime);
    return () => clearInterval(interval);
  }, [isActive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let phase = 0;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const render = () => {
      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;

      // Clean warm off-white backing matching the new body canvas
      ctx.fillStyle = "#faf9f6";
      ctx.fillRect(0, 0, w, h);

      // Draw technical architectural alignment grid
      ctx.strokeStyle = "#e5e5e0";
      ctx.lineWidth = 0.5;
      
      const gridSpacing = 20;
      // Vertical grid lines
      for (let x = 0; x < w; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      // Horizontal grid lines
      for (let y = 0; y < h; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Standby signal drift
      const time = Date.now() * 0.001;
      const driftAmp = Math.sin(time * 0.4) * 2;
      const driftFreq = Math.cos(time * 0.25) * 0.5;

      const amp = (isActive ? 22 : 11) + driftAmp;
      const speed = isActive ? 0.14 : 0.045;
      phase += speed;

      // Draw active primary waveform (Zinc-900 Charcoal)
      ctx.strokeStyle = "#09090b";
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      for (let x = 0; x < w; x++) {
        const angle = (x / w) * Math.PI * (4 + driftFreq) + phase;
        const y = h / 2 + Math.sin(angle) * amp + Math.cos(angle * 2.2 - phase * 0.6) * (amp * 0.25);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Secondary fine Swiss Crimson Red accent wave
      ctx.strokeStyle = "#e31b23";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const angle = (x / w) * Math.PI * (6 + driftFreq * 0.6) - phase * 1.2;
        const y = h / 2 + Math.sin(angle) * (amp * 0.4) * Math.cos(phase * 0.15 + x * 0.002);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Technical HUD overlay borders
      ctx.strokeStyle = "#09090b";
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.15;
      ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.globalAlpha = 1.0;

      // Telemetry labels (Sleek minimalist monospace)
      ctx.fillStyle = "#70706b";
      ctx.font = "500 8.5px monospace";
      ctx.fillText(`INDEX // ${isActive ? "SCANNING" : "STANDBY"}`, 16, 24);
      ctx.fillText(`FREQ  // ${metrics.frequency} HZ`, 16, h - 34);
      ctx.fillText(`DB    // ${metrics.decibels} DB`, 16, h - 20);
      
      // Top right system telemetry stats
      ctx.textAlign = "right";
      ctx.fillText(`FLUX  // ${metrics.flux}%`, w - 16, 24);
      ctx.textAlign = "left"; // reset

      // Architectural engineering crosshairs
      ctx.strokeStyle = "#09090b";
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.moveTo(w / 2, 12); ctx.lineTo(w / 2, h - 12);
      ctx.moveTo(12, h / 2); ctx.lineTo(w - 12, h / 2);
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isActive, metrics]);

  return (
    <div
      onMouseEnter={() => {
        setHovered(true);
        sound.play("hover");
      }}
      onMouseLeave={() => setHovered(false)}
      onClick={() => sound.play("click")}
      className={`relative w-full h-full min-h-[140px] bg-white overflow-hidden group cursor-crosshair ${
        flat 
          ? "border-0 shadow-none" 
          : "border border-zinc-200 hover:border-zinc-400 hover:shadow-md transition-all duration-300 rounded-sm"
      }`}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
      {/* Light minimalist crosshair highlight overlay */}
      <div className="absolute inset-0 bg-red-600/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </div>
  );
}
