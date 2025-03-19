import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency, formatDate, getInitials, getLoanStatus } from "@/lib/utils";
import Sidebar from "@/components/navigation/sidebar";
import MobileHeader from "@/components/navigation/mobile-header";
import StatCard from "@/components/dashboard/stat-card";
import ActionCard from "@/components/dashboard/action-card";
import ActivityCard from "@/components/dashboard/activity-card";
import ClientForm from "@/components/forms/client-form";
import LoanForm from "@/components/forms/loan-form";
import PaymentForm from "@/components/forms/payment-form";
import { Cliente, Prestamo, Pago } from "@shared/schema";

interface Estadisticas {
  prestamosActivos: number;
  totalPrestado: number;
  montosPagosHoy: number;
  prestamosAtrasados: number;
  ultimosPrestamos: Prestamo[];
  ultimosPagos: Pago[];
  ultimosClientes: Cliente[];
}

export default function Dashboard() {
  const [clientFormOpen, setClientFormOpen] = useState(false);
  const [loanFormOpen, setLoanFormOpen] = useState(false);
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);

  // Cargar las estadísticas
  const { data: estadisticas, isLoading } = useQuery<Estadisticas>({
    queryKey: ['/api/estadisticas'],
  });

  // Cargar clientes para relacionar con préstamos y pagos
  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ['/api/clientes'],
  });

  // Fecha actual
  const fechaActual = new Date();
  const opcionesFecha = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' } as const;
  const fechaFormateada = fechaActual.toLocaleDateString('es-ES', opcionesFecha);

  // Preparar datos para las tarjetas de actividad
  const prepararItemsPagos = () => {
    if (!estadisticas?.ultimosPagos || !clientes.length) return [];
    
    return estadisticas.ultimosPagos.map(pago => {
      // Buscar el préstamo correspondiente
      const prestamo = estadisticas.ultimosPrestamos.find(p => p.id === pago.prestamo_id);
      // Buscar el cliente correspondiente
      const cliente = prestamo ? clientes.find(c => c.id === prestamo.cliente_id) : undefined;
      
      return {
        id: pago.id,
        title: cliente?.nombre || 'Cliente',
        subtitle: formatDate(pago.fecha_pago),
        amount: formatCurrency(pago.monto_pagado),
        status: "pago"
      };
    });
  };

  const prepararItemsPrestamos = () => {
    if (!estadisticas?.ultimosPrestamos || !clientes.length) return [];
    
    return estadisticas.ultimosPrestamos.map(prestamo => {
      // Buscar el cliente correspondiente
      const cliente = clientes.find(c => c.id === prestamo.cliente_id);
      const { label, className } = getLoanStatus(prestamo.estado);
      
      return {
        id: prestamo.id,
        title: cliente?.nombre || 'Cliente',
        subtitle: formatDate(prestamo.fecha_prestamo),
        amount: formatCurrency(prestamo.monto_prestado),
        status: label,
        statusClass: className,
        link: `/prestamos/${prestamo.id}`
      };
    });
  };

  const prepararItemsClientes = () => {
    if (!estadisticas?.ultimosClientes) return [];
    
    return estadisticas.ultimosClientes.map(cliente => {
      return {
        id: cliente.id,
        title: cliente.nombre,
        subtitle: `Registrado: ${formatDate(cliente.fecha_registro)}`,
        image: (
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-sm font-medium text-gray-600">{getInitials(cliente.nombre)}</span>
          </div>
        ),
        link: `/clientes/${cliente.id}`
      };
    });
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <Sidebar />
      <MobileHeader />
      
      <main className="flex-1 overflow-y-auto p-4 md:p-6 md:pt-4 mt-16 md:mt-0">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Panel de Control</h1>
          <p className="text-sm text-gray-600">{fechaFormateada}</p>
        </header>
        
        {/* Stats Section */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Estadísticas</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
              title="Préstamos Activos" 
              value={isLoading ? "..." : estadisticas?.prestamosActivos.toString() || "0"} 
              icon="file-invoice-dollar" 
              color="bg-blue-100" 
            />
            
            <StatCard 
              title="Total Prestado" 
              value={isLoading ? "..." : formatCurrency(estadisticas?.totalPrestado || 0)} 
              icon="dollar-sign" 
              color="bg-green-100" 
            />
            
            <StatCard 
              title="Pagos del Día" 
              value={isLoading ? "..." : formatCurrency(estadisticas?.montosPagosHoy || 0)} 
              icon="calendar-day" 
              color="bg-indigo-100" 
            />
            
            <StatCard 
              title="Pagos Atrasados" 
              value={isLoading ? "..." : estadisticas?.prestamosAtrasados.toString() || "0"} 
              icon="exclamation-triangle" 
              color="bg-red-100" 
            />
          </div>
        </section>
        
        {/* Quick Actions */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Acciones Rápidas</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ActionCard 
              title="Registrar Cliente" 
              description="Añadir un nuevo cliente al sistema" 
              icon="user-plus" 
              color="bg-blue-100" 
              buttonText="Nuevo Cliente"
              onClick={() => setClientFormOpen(true)}
            />
            
            <ActionCard 
              title="Crear Préstamo" 
              description="Generar un nuevo préstamo" 
              icon="hand-holding-usd" 
              color="bg-green-100" 
              buttonText="Nuevo Préstamo"
              onClick={() => setLoanFormOpen(true)}
            />
            
            <ActionCard 
              title="Registrar Pago" 
              description="Añadir un nuevo pago de préstamo" 
              icon="money-bill-wave" 
              color="bg-indigo-100" 
              buttonText="Registrar Pago"
              onClick={() => setPaymentFormOpen(true)}
            />
          </div>
        </section>
        
        {/* Recent Activity */}
        <section>
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Actividad Reciente</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ActivityCard 
              title="Pagos Recientes" 
              items={prepararItemsPagos()} 
              viewAllLink="/pagos" 
              viewAllText="Ver todos los pagos"
            />
            
            <ActivityCard 
              title="Préstamos Recientes" 
              items={prepararItemsPrestamos()} 
              viewAllLink="/prestamos" 
              viewAllText="Ver todos los préstamos"
            />
            
            <ActivityCard 
              title="Clientes Recientes" 
              items={prepararItemsClientes()} 
              viewAllLink="/clientes" 
              viewAllText="Ver todos los clientes"
            />
          </div>
        </section>
        
        {/* Modals */}
        <ClientForm 
          open={clientFormOpen} 
          onOpenChange={setClientFormOpen} 
        />
        
        <LoanForm 
          open={loanFormOpen} 
          onOpenChange={setLoanFormOpen} 
        />
        
        <PaymentForm 
          open={paymentFormOpen} 
          onOpenChange={setPaymentFormOpen} 
        />
      </main>
    </div>
  );
}
