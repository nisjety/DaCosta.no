// src/lib/utils.ts
import { twMerge } from "tailwind-merge";
import clsx, { ClassValue } from "clsx";

/**  
 * cn("p-2", condition && "text-white")  
 * → sammenslår klassene og håndterer dubletter på Tailwind-måten  
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(...inputs));
}
