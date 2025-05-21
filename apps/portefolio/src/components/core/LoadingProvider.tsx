"use client";

import { useState, useEffect, useRef, ReactNode } from "react";
import { usePathname } from "next/navigation";
import PageTransition from "@/components/core/PageTransition";
import ParticleLoader from "@/components/core/ParticleLoader";

interface LoadingProviderProps {
  children: ReactNode;
}

export default function LoadingProvider({ children }: LoadingProviderProps) {
  const pathname = usePathname();
  const [showLoader, setShowLoader] = useState(false); // Start with loader hidden until we check conditions
  const [animationComplete, setAnimationComplete] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const maxLoadTimeRef = useRef<NodeJS.Timeout | null>(null);
  const pageLoadedRef = useRef(false);
  
  // This forces a minimum display time for the animation
  const minAnimationTimeRef = useRef<NodeJS.Timeout | null>(null);
  const MIN_ANIMATION_TIME = 5000; // 5 seconds minimum for the animation

  // Check if we're on the home page ("/", "/home", or "/home/")
  const isHomePage = pathname === "/" || pathname === "/home" || pathname === "/home/";

  // Run this effect only once on component mount
  useEffect(() => {
    console.log("LoadingProvider mounting, pathname:", pathname);
    
    // Skip the entire effect if we've already processed this page load
    if (pageLoadedRef.current) {
      console.log("Page already loaded, skipping loader check");
      return;
    }
    
    // Mark as processed to prevent duplicate runs
    pageLoadedRef.current = true;
    
    // Create a local flag to track if we need the loader
    let needsLoader = false;
    
    // Check if we're on the home page
    if (isHomePage) {
      console.log("Home page detected - will show loader");
      needsLoader = true;
    } else {
      // For non-home pages, check session storage
      try {
        if (typeof window !== 'undefined') {
          const hasVisited = sessionStorage.getItem("has_visited");
          
          if (!hasVisited) {
            // First visit to the site
            console.log("First visit detected - will show loader");
            sessionStorage.setItem("has_visited", "true");
            needsLoader = true;
          } else {
            console.log("Return visitor on non-home page - skipping loader");
          }
        }
      } catch (error) {
        console.error("Error checking session storage:", error);
      }
    }
    
    // Now update state based on our needs
    if (needsLoader) {
      // This timeout ensures we don't get React hydration mismatches
      setTimeout(() => {
        setShowLoader(true);
        setAnimationComplete(false);
        setInitialLoadComplete(false);
        
        // Start the minimum animation timer
        minAnimationTimeRef.current = setTimeout(() => {
          console.log("Minimum animation time reached");
          setAnimationComplete(true);
        }, MIN_ANIMATION_TIME);
        
        // Maximum load time fallback - absolute maximum wait time
        maxLoadTimeRef.current = setTimeout(() => {
          console.log("Maximum load time reached, forcing completion");
          setAnimationComplete(true);
          setInitialLoadComplete(true);
        }, 12000); // 12 seconds absolute maximum
      }, 0);
    } else {
      // Skip loader entirely
      setShowLoader(false);
      setAnimationComplete(true);
      setInitialLoadComplete(true);
    }
    
    // Cleanup
    return () => {
      if (maxLoadTimeRef.current) {
        clearTimeout(maxLoadTimeRef.current);
        maxLoadTimeRef.current = null;
      }
      if (minAnimationTimeRef.current) {
        clearTimeout(minAnimationTimeRef.current);
        minAnimationTimeRef.current = null;
      }
    };
  }, [isHomePage, pathname]); // Added dependencies that are used in the effect
  
  // Effect that tracks route changes
  useEffect(() => {
    // This runs on pathname changes - if we wanted to show the loader on route changes
    // we would implement that logic here
    const currentPath = pathname;
    // Removed unused isHome variable
    
    console.log("Path changed to:", currentPath);
    
    // Currently we don't show the loader on client-side navigation
    // If you want to enable that, you could add logic here
  }, [pathname, isHomePage]); // Added isHomePage as a dependency since it's used in the hook

  // Called when the animation signals completion
  const handleAnimationComplete = () => {
    console.log("Animation signaled completion");
    setAnimationComplete(true);
  };

  // Called when all content is ready to be shown
  useEffect(() => {
    if (showLoader && !initialLoadComplete) {
      // Start loading site content in background
      console.log("Preloading site content");
      
      // Give a small delay to let animation start first
      const contentTimer = setTimeout(() => {
        console.log("Content is ready");
        setInitialLoadComplete(true);
      }, 300);
      
      return () => clearTimeout(contentTimer);
    }
  }, [showLoader, initialLoadComplete]);

  // Only show content when BOTH animation is complete AND content is ready,
  // or when we're not showing the loader at all
  const showContent = !showLoader || (animationComplete && initialLoadComplete);

  console.log("Render state:", { showLoader, animationComplete, initialLoadComplete, showContent });

  return (
    <>
      {/* Particle text loader (only shown when needed) */}
      {showLoader && (!animationComplete || !initialLoadComplete) && (
        <ParticleLoader onLoadComplete={handleAnimationComplete} />
      )}
      
      {/* Only show content when conditions are met */}
      {showContent ? (
        <PageTransition>
          {children}
        </PageTransition>
      ) : (
        // Hidden div that still renders children for preloading
        <div style={{ display: 'none' }}>{children}</div>
      )}
    </>
  );
}