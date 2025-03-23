import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Calendar, AlertTriangle, Users } from "lucide-react";
import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
}

export default function StatCard({ title, value, icon, color }: StatCardProps) {
  // Mapeo de iconos a componentes de Lucide
  const getIcon = (): ReactNode => {
    const iconProps = { className: "h-5 w-5 text-white" };
    
    switch (icon) {
      case 'dollar-sign':
        return <DollarSign {...iconProps} />;
      case 'calendar-day':
        return <Calendar {...iconProps} />;
      case 'exclamation-triangle':
        return <AlertTriangle {...iconProps} />;
      case 'users':
        return <Users {...iconProps} />;
      default:
        return <DollarSign {...iconProps} />;
    }
  };

  // Mapeo de color a clases Tailwind
  const getBgColor = (): string => {
    switch (icon) {
      case 'dollar-sign':
        return 'bg-emerald-600 dark:bg-emerald-500';
      case 'calendar-day':
        return 'bg-indigo-600 dark:bg-indigo-500';
      case 'exclamation-triangle':
        return 'bg-red-600 dark:bg-red-500';
      case 'users':
        return 'bg-blue-600 dark:bg-blue-500';
      default:
        return 'bg-primary';
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow border-2">
      <CardContent className="p-4">
        <div className="flex items-center">
          <div className={`rounded-full ${getBgColor()} p-3 mr-4`}>
            {getIcon()}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
