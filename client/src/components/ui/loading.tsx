import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingProps {
  className?: string;
  text?: string;
  fullScreen?: boolean;
  size?: "sm" | "md" | "lg";
}

// Componente de carga que puede ser usado en toda la aplicación
export function Loading({ 
  className, 
  text = "Cargando...", 
  fullScreen = false,
  size = "md"
}: LoadingProps) {
  // Configuración de tamaño para el spinner
  const sizeConfig = {
    sm: {
      container: "py-2",
      spinner: "h-4 w-4",
      text: "text-xs"
    },
    md: {
      container: "py-4",
      spinner: "h-6 w-6",
      text: "text-sm"
    },
    lg: {
      container: "py-6",
      spinner: "h-8 w-8",
      text: "text-base"
    }
  };

  const config = sizeConfig[size];

  // Estilos para el contenedor
  const containerClasses = cn(
    "flex flex-col items-center justify-center",
    config.container,
    fullScreen ? "fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" : "",
    className
  );

  return (
    <div className={containerClasses}>
      <Loader2 className={cn("animate-spin text-primary", config.spinner)} />
      {text && <p className={cn("mt-2 text-muted-foreground animate-pulse", config.text)}>{text}</p>}
    </div>
  );
}

// Overlay de carga a pantalla completa
export function FullScreenLoading({ text, className }: { text?: string; className?: string }) {
  return (
    <div className={cn("fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center", className)}>
      <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 shadow-xl border border-white/20">
        <Loading text={text || "Procesando operación..."} size="lg" />
      </div>
    </div>
  );
}

// Componente para mostrar que los datos están cargando
export function LoadingData({ text = "Cargando datos..." }: { text?: string }) {
  return (
    <div className="w-full py-8 text-center">
      <Loading text={text} size="md" />
    </div>
  );
}

// Componente para mostrar en botones cuando una acción está en progreso
export function LoadingButton({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} />;
}