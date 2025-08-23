import { Navbar } from './components/Navbar';
import HomePage from './pages/HomePage';
import './index.css';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';

function RevolvingBlobs() {
  // Center of the screen
  const [center, setCenter] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function updateCenter() {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCenter({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
      }
    }
    updateCenter();
    window.addEventListener('resize', updateCenter);
    return () => window.removeEventListener('resize', updateCenter);
  }, []);

  // Only two blobs, opposite each other
  const blobs = [
    {
      size: 480,
      className: "bg-gradient-to-tr from-indigo-300 via-purple-300 to-pink-300 opacity-50 blur-3xl",
      radius: 320,
      zIndex: 0,
      offset: 0, // angle offset in radians
    },
    {
      size: 480,
      className: "bg-gradient-to-tr from-pink-400 via-indigo-400 to-purple-500 opacity-30 blur-2xl",
      radius: 320,
      zIndex: 0,
      offset: Math.PI, // 180 degrees opposite
    },
  ];

  // Shared angle for both blobs
  const angle = useMotionValue(0);

  useEffect(() => {
    let frame: number;
    let start: number | null = null;
    function animate(ts: number) {
      if (start === null) start = ts;
      const elapsed = (ts - start) / 1000;
      const duration = 18;
      const theta = (elapsed / duration) * Math.PI * 2;
      angle.set(theta);
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [angle]);

  return (
    <div ref={containerRef} className="fixed inset-0 w-full h-full pointer-events-none z-0">
      {blobs.map((blob, i) => {
        // Each blob is offset by 0 or PI (opposite)
        const x = useTransform(angle, theta =>
          center.x + blob.radius * Math.cos(theta + blob.offset) - blob.size / 2
        );
        const y = useTransform(angle, theta =>
          center.y + blob.radius * Math.sin(theta + blob.offset) - blob.size / 2
        );
        return (
          <motion.div
            key={i}
            aria-hidden="true"
            className={`pointer-events-none absolute rounded-full ${blob.className}`}
            style={{
              width: blob.size,
              height: blob.size,
              left: 0,
              top: 0,
              x,
              y,
              zIndex: blob.zIndex,
            }}
          />
        );
      })}
    </div>
  );
}

function App() {
  return (
    <div className="relative w-full min-h-screen flex flex-col bg-gradient-to-br from-[#f9fafb] via-[#f3f4f6] to-[#e5e7eb] overflow-hidden">
      {/* Revolving Blobs in the whole background */}
      <RevolvingBlobs />

      <div aria-hidden="true" className="pointer-events-none absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-blue-300 via-purple-300 to-pink-300 opacity-30 blur-3xl" style={{ zIndex: 0, filter: 'blur(80px)', }} /> 
      <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 w-[450px] h-[450px] rounded-full bg-gradient-to-tr from-pink-200 via-blue-300 to-purple-400 opacity-30 blur-2xl" style={{ zIndex: 0, filter: 'blur(60px)', }} />

      <Navbar />

      {/* Main content */}
      <main className="flex-1 z-10 w-full">
        <HomePage />
      </main>
    </div>
  );
}

export default App;
