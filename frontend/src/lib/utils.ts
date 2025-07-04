import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string | number, formatPattern: string = "yyyy-MM-dd") {
  return format(new Date(date), formatPattern)
}

export function formatDateTime(date: Date | string | number, formatPattern: string = "yyyy-MM-dd HH:mm:ss") {
  return format(new Date(date), formatPattern)
}
