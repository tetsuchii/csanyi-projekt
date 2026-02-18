import React, { useEffect, useState, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui/button';
import { X } from 'lucide-react';

export type TourStep = {
  id: string;
  targetId: string;
  title: string;
  description: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
};

interface InteractiveTourProps {
  steps: TourStep[];
  currentStepIndex: number;
  isOpen: boolean;
  onNext: () => void;
  onClose: () => void;
}

export const InteractiveTour = ({ steps, currentStepIndex, isOpen, onNext, onClose }: InteractiveTourProps) => {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [targetBorderRadius, setTargetBorderRadius] = useState<string>('4px');
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({ opacity: 0, pointerEvents: 'none' });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const step = steps[currentStepIndex];

  // 1. Find Target Rect & Styles
  useLayoutEffect(() => {
    if (!isOpen || !step) return;

    const updateRect = () => {
      const el = document.getElementById(step.targetId);
      if (el) {
        const rect = el.getBoundingClientRect();
        const styles = window.getComputedStyle(el);
        const borderRadius = styles.borderRadius || '4px';
        
        // Only update rect if significantly changed to avoid loops
        setTargetRect(prev => {
            if (!prev) return rect;
            if (
                Math.abs(prev.top - rect.top) < 1 && 
                Math.abs(prev.left - rect.left) < 1 && 
                Math.abs(prev.width - rect.width) < 1 &&
                Math.abs(prev.height - rect.height) < 1
            ) {
                return prev;
            }
            return rect;
        });

        // Only update border radius if changed
        setTargetBorderRadius(prev => {
            if (prev === borderRadius) return prev;
            return borderRadius;
        });

      } else {
        setTargetRect(null);
      }
    };

    updateRect();
    const timer = setInterval(updateRect, 500);
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [isOpen, step]);

  // 2. Calculate Tooltip Position
  useLayoutEffect(() => {
      if (!targetRect || !tooltipRef.current || !step) return;

      const tooltip = tooltipRef.current;
      const { width, height } = tooltip.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const GAP = 12;
      const PADDING = 10;

      // Helper to check if a position fits
      const checkFit = (p: string): boolean => {
          if (p === 'top') return targetRect.top - height - GAP >= PADDING;
          if (p === 'bottom') return targetRect.bottom + height + GAP <= viewportHeight - PADDING;
          if (p === 'left') return targetRect.left - width - GAP >= PADDING;
          if (p === 'right') return targetRect.right + width + GAP <= viewportWidth - PADDING;
          return false;
      };

      // Determine best placement
      let placement = step.placement || 'bottom';
      if (!checkFit(placement)) {
          // Try alternatives in preference order
          const order = ['bottom', 'top', 'left', 'right'];
          const better = order.find(p => checkFit(p));
          if (better) placement = better;
      }

      let top = 0;
      let left = 0;

      switch (placement) {
          case 'top':
              top = targetRect.top - height - GAP;
              left = targetRect.left + (targetRect.width / 2) - (width / 2);
              break;
          case 'bottom':
              top = targetRect.bottom + GAP;
              left = targetRect.left + (targetRect.width / 2) - (width / 2);
              break;
          case 'left':
              top = targetRect.top + (targetRect.height / 2) - (height / 2);
              left = targetRect.left - width - GAP;
              break;
          case 'right':
              top = targetRect.top + (targetRect.height / 2) - (height / 2);
              left = targetRect.right + GAP;
              break;
      }

      // Clamp to Viewport
      left = Math.max(PADDING, Math.min(left, viewportWidth - width - PADDING));
      top = Math.max(PADDING, Math.min(top, viewportHeight - height - PADDING));

      setTooltipStyle({
          top,
          left,
          opacity: 1,
          pointerEvents: 'auto',
          position: 'absolute'
      });

  }, [targetRect, step]);

  if (!isOpen || !step) return null;

  const computedRadius = targetBorderRadius.includes('%') ? targetBorderRadius : `calc(${targetBorderRadius} + 4px)`;
  
  return createPortal(
    <div className="fixed inset-0 z-[100]" style={{ pointerEvents: 'none' }}>
      {/* Dark overlay with hole for target */}
      {targetRect && (
        <>
          {/* Top */}
          <div 
            className="absolute bg-black/70"
            style={{
              top: 0,
              left: 0,
              right: 0,
              height: targetRect.top - 4,
              pointerEvents: targetRect.top - 4 > 0 ? 'auto' : 'none'
            }}
          />
          {/* Bottom */}
          <div 
            className="absolute bg-black/70"
            style={{
              top: targetRect.bottom + 4,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: 'auto'
            }}
          />
          {/* Left */}
          <div 
            className="absolute bg-black/70"
            style={{
              top: targetRect.top - 4,
              left: 0,
              width: targetRect.left - 4,
              height: targetRect.height + 8,
              pointerEvents: targetRect.left - 4 > 0 ? 'auto' : 'none'
            }}
          />
          {/* Right */}
          <div 
            className="absolute bg-black/70"
            style={{
              top: targetRect.top - 4,
              left: targetRect.right + 4,
              right: 0,
              height: targetRect.height + 8,
              pointerEvents: 'auto'
            }}
          />
          {/* Highlight border */}
          <div 
              className="absolute transition-all duration-300 ease-in-out border-2 border-indigo-500 pointer-events-none"
              style={{
                  top: targetRect.top - 4,
                  left: targetRect.left - 4,
                  width: targetRect.width + 8,
                  height: targetRect.height + 8,
                  borderRadius: computedRadius
              }}
          />
        </>
      )}

      {/* Tooltip */}
      <div 
        ref={tooltipRef}
        className="bg-white p-4 rounded-lg shadow-xl w-[20rem] max-w-[calc(100vw-20px)] transition-all duration-300 ease-out flex flex-col gap-3"
        style={tooltipStyle}
      >
         <div className="flex justify-between items-start gap-2">
             <h3 className="font-bold text-slate-900">{step.title}</h3>
             <Button variant="ghost" size="icon" className="h-6 w-6 -mt-1 -mr-1 text-slate-400 hover:text-slate-600" onClick={onClose}>
                 <X className="w-4 h-4" />
             </Button>
         </div>
         <div className="text-sm text-slate-600">
             {step.description}
         </div>
      </div>
    </div>,
    document.body
  );
};