"use client";

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ParticleLoaderProps {
  onLoadComplete?: () => void;
}

interface Particle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  size: number;
  color: string;
  speedFactor: number;
  opacity: number;
}

const ParticleLoader: React.FC<ParticleLoaderProps> = ({ onLoadComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [animationStage, setAnimationStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  // Safety timeout
  useEffect(() => {
    const safety = setTimeout(() => {
      if (loading) {
        setProgress(100);
        setAnimationStage(3);
        setLoading(false);
        onLoadComplete?.();
      }
    }, 10000);
    return () => clearTimeout(safety);
  }, [loading, onLoadComplete]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Easing: slow start & end
    const easeInOutQuad = (t: number) =>
      t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    // Build text path by sampling off-screen canvas
    const createTextPath = () => {
      const off = document.createElement('canvas');
      const octx = off.getContext('2d')!;
      const text = "Ima Da Costa";
      const fontSize = Math.min(canvas.width / 8, 120);
      octx.font = `${fontSize}px sans-serif`;
      const metrics = octx.measureText(text);
      off.width = metrics.width;
      off.height = fontSize;
      octx.font = `${fontSize}px sans-serif`;
      octx.textBaseline = 'top';
      octx.fillStyle = '#000';
      octx.fillText(text, 0, 0);

      const data = octx.getImageData(0, 0, off.width, off.height).data;
      const pts: { x: number; y: number }[] = [];
      const gap = 6;
      for (let y = 0; y < off.height; y += gap) {
        for (let x = 0; x < off.width; x += gap) {
          if (data[(y * off.width + x) * 4 + 3] > 128) {
            pts.push({
              x: centerX - off.width / 2 + x,
              y: centerY - off.height / 2 + y,
            });
          }
        }
      }
      return pts;
    };

    const textParticles = createTextPath();
    const totalParticles = Math.max(textParticles.length, 1200);
    const particles: Particle[] = [];

    for (let i = 0; i < totalParticles; i++) {
      const startX = Math.random() * canvas.width;
      const startY = Math.random() * canvas.height;
      const tgt = textParticles[i % textParticles.length];
      particles.push({
        x: startX,
        y: startY,
        targetX: tgt.x,
        targetY: tgt.y,
        size: 1 + Math.random() * 1.5,
        color: `rgba(34,34,34,${0.6 + Math.random() * 0.4})`,
        speedFactor: 0.8 + Math.random() * 0.4,
        opacity: 1,
      });
    }

    // Timings
    const formationDuration = 2000;
    const holdDuration = 1500;
    const fadeDuration = 1500;
    const totalDuration = formationDuration + holdDuration + fadeDuration;

    let startTime: number | null = null;
    let completed = false;

    const animate = (ts: number) => {
      if (!startTime) startTime = ts;
      const elapsed = ts - startTime;

      // Progress mapping: formation → 0–80%, then remainder → 80–100%
      let pct;
      if (elapsed < formationDuration) {
        pct = (elapsed / formationDuration) * 80;
      } else {
        pct = 80 + ((elapsed - formationDuration) / (totalDuration - formationDuration)) * 20;
      }
      setProgress(Math.min(100, Math.round(pct)));

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Determine stage
      if (elapsed < formationDuration) setAnimationStage(0);
      else if (elapsed < formationDuration + holdDuration) setAnimationStage(1);
      else if (elapsed < totalDuration) setAnimationStage(2);
      else if (!completed) {
        setAnimationStage(3);
        completed = true;
        setTimeout(() => {
          setLoading(false);
          onLoadComplete?.();
        }, 400);
        return;
      }

      // Compute eased movement coefficient only during formation
      let moveCoef = 1;
      if (elapsed < formationDuration) {
        const t = Math.min(elapsed / formationDuration, 1);
        moveCoef = easeInOutQuad(t);
      }

      // Draw particles
      particles.forEach(p => {
        if (elapsed < formationDuration) {
          p.x += (p.targetX - p.x) * 0.1 * p.speedFactor * moveCoef;
          p.y += (p.targetY - p.y) * 0.1 * p.speedFactor * moveCoef;
        }
        const baseAlpha = parseFloat(p.color.split(/rgba\(.*,(.*)\)/)[1] || '1');
        let alpha = baseAlpha;
        if (elapsed >= formationDuration + holdDuration) {
          // fade out
          const fadeT = (elapsed - formationDuration - holdDuration) / fadeDuration;
          alpha = baseAlpha * (1 - fadeT);
        }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
    return () => window.removeEventListener('resize', resize);
  }, [onLoadComplete]);

  return (
    <AnimatePresence mode="wait">
      {loading && (
        <motion.div
          className="fixed inset-0 flex flex-col items-center justify-center bg-white z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.8, ease: [0.65, 0, 0.35, 1] } }}
        >
          {/* noise */}
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none noise"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />

          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

          <div className="absolute bottom-[15vh] left-0 right-0 flex flex-col items-center">
            <div className="w-64 md:w-80 flex flex-col items-center gap-3 z-10">
              <div className="w-full h-[2px] bg-[#f8f8f8] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[#222]"
                  initial={{ width: '0%' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: [0.65, 0, 0.35, 1] }}
                />
              </div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="text-[#7b7b7b] text-sm w-full font-['Space_Grotesk'] flex justify-between"
              >
                <span>
                  {animationStage === 0 && 'Laster inn...'}
                  {animationStage === 1 && 'Ima Da Costa'}
                  {(animationStage === 2 || animationStage === 3) && 'Velkommen...'}
                </span>
                <span>{progress}%</span>
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ParticleLoader;
