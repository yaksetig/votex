
// Re-export from hooks for backward compatibility
import { useToast as useToastHook, toast as toastFunction } from "@/hooks/use-toast";

// Export with the same names
export const useToast = useToastHook;
export const toast = toastFunction;
