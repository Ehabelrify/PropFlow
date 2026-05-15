import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get properly formatted property image URL
 * Handles null/undefined values and ensures proper URL formatting
 */
export function getPropertyImageUrl(imagePath: string | null | undefined): string | null {
  if (!imagePath) return null;
  
  // If already a full URL, return as-is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // If using Supabase storage, construct proper URL
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (supabaseUrl && imagePath.startsWith('properties/')) {
    return `${supabaseUrl}/storage/v1/object/public/${imagePath}`;
  }
  
  return imagePath;
}
