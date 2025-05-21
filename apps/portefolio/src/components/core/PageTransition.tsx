"use client";

import React, { useState, useEffect, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface PageTransitionProps {
  children: ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const [activePathname, setActivePathname] = useState(pathname);
  
  useEffect(() => {
    if (pathname !== activePathname) {
      // Route is changing
      setIsNavigating(true);
      
      // Set timer to update the active pathname after animation completes
      const timer = setTimeout(() => {
        setActivePathname(pathname);
        setIsNavigating(false);
      }, 600); // Match this with your exit animation duration
      
      return () => clearTimeout(timer);
    }
  }, [pathname, activePathname]);
  
  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {isNavigating && (
          <motion.div
            key="page-transition"
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="relative w-full h-full">
              {/* Light transition overlay */}
              <motion.div 
                className="absolute inset-0 bg-white"
                initial={{ scaleX: 0, transformOrigin: "left" }}
                animate={{ scaleX: 1, transformOrigin: "left" }}
                exit={{ scaleX: 0, transformOrigin: "right" }}
                transition={{ duration: 0.6, ease: [0.65, 0, 0.35, 1] }}
              />
              
              {/* Subtle progress bar at the bottom */}
              <motion.div 
                className="absolute bottom-0 left-0 h-1 bg-[#222222]"
                initial={{ scaleX: 0, transformOrigin: "left" }}
                animate={{ scaleX: 1, transformOrigin: "left" }}
                transition={{ duration: 0.5, ease: "linear" }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <motion.div
        key={activePathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        {children}
      </motion.div>
    </div>
  );
}