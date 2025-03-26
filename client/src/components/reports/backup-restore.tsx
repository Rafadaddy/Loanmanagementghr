import React, { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Download, Upload, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loading } from "@/components/ui/loading";

export function BackupRestoreSection() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<boolean>(false);

  // Mutación para exportar datos (descarga)
  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/sistema/exportar");
      return response.json();
    },
    onSuccess: (data) => {
      // Crear un objeto Blob con los datos
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      
      // Crear un link de descarga y hacer clic en él
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const fechaActual = new Date().toISOString().split("T")[0];
      a.href = url;
      a.download = `backup_sistema_${fechaActual}.json`;
      document.body.appendChild(a);
      a.click();
      
      // Limpiar
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Exportación exitosa",
        description: "Los datos se han exportado correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al exportar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutación para importar datos
  const importMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/sistema/importar", data);
      return response.json();
    },
    onSuccess: () => {
      setImportSuccess(true);
      setImportError(null);
      toast({
        title: "Importación exitosa",
        description: "Los datos se han importado correctamente. La página se recargará en 3 segundos.",
      });
      
      // Recargar la página después de 3 segundos para reflejar los cambios
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    },
    onError: (error: Error) => {
      setImportError(error.message);
      setImportSuccess(false);
      toast({
        title: "Error al importar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleExportClick = () => {
    exportMutation.mutate();
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reiniciar estados
    setImportError(null);
    setImportSuccess(false);

    // Validar tipo de archivo
    if (file.type !== "application/json" && !file.name.endsWith('.json')) {
      setImportError("El archivo debe ser de tipo JSON");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        
        // Validar estructura básica del archivo
        const requiredFields = ['users', 'clientes', 'prestamos', 'pagos', 'cobradores', 'movimientosCaja'];
        const missingFields = requiredFields.filter(field => !data[field]);
        
        if (missingFields.length > 0) {
          setImportError(`El archivo no contiene todos los datos necesarios. Faltan: ${missingFields.join(', ')}`);
          return;
        }
        
        // Enviar datos para importar
        importMutation.mutate(data);
      } catch (error) {
        setImportError("Error al procesar el archivo JSON");
      }
    };
    reader.readAsText(file);
  };

  return (
    <Card className="w-full shadow-md">
      <CardHeader>
        <CardTitle className="text-xl">Respaldo y Restauración del Sistema</CardTitle>
        <CardDescription>
          Permite exportar todos los datos del sistema para respaldo o importarlos para restauración
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-medium">Exportar datos</h3>
              <p className="text-sm text-muted-foreground">
                Descarga un archivo JSON con todos los datos del sistema. Este archivo se puede
                utilizar para restaurar el sistema en caso de pérdida de datos.
              </p>
              <Button 
                variant="default" 
                className="mt-2 w-full md:w-auto"
                onClick={handleExportClick}
                disabled={exportMutation.isPending}
              >
                {exportMutation.isPending ? (
                  <Loading className="mr-2 h-4 w-4" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Exportar datos
              </Button>
            </div>
            
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-medium">Importar datos</h3>
              <p className="text-sm text-muted-foreground">
                Restaura los datos del sistema a partir de un archivo de respaldo. 
                <strong className="block mt-1 text-orange-500">
                  ¡Atención! Esta acción reemplazará todos los datos actuales.
                </strong>
              </p>
              <Button 
                variant="outline" 
                className="mt-2 w-full md:w-auto"
                onClick={handleImportClick}
                disabled={importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <Loading className="mr-2 h-4 w-4" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Importar datos
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".json,application/json"
                className="hidden"
              />
            </div>
          </div>

          {importError && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{importError}</AlertDescription>
            </Alert>
          )}

          {importSuccess && (
            <Alert className="mt-4 bg-green-50 border-green-200 text-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertTitle>Éxito</AlertTitle>
              <AlertDescription>
                Los datos se han importado correctamente. La página se recargará en unos segundos.
              </AlertDescription>
            </Alert>
          )}

          <Alert variant="warning" className="mt-4 bg-amber-50 border-amber-200 text-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertTitle>Recomendación</AlertTitle>
            <AlertDescription>
              Realice respaldos periódicos para evitar pérdida de información. 
              La restauración de datos reemplazará toda la información actual del sistema.
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
    </Card>
  );
}

export default BackupRestoreSection;