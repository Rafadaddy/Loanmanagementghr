import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, CircleDollarSign, Wallet } from "lucide-react";
import { ReactNode } from "react";

interface ActionCardProps {
  title: string;
  description: string;
  icon: string;
  color: string;
  buttonText: string;
  onClick: () => void;
}

export default function ActionCard({ 
  title, 
  description, 
  icon, 
  color, 
  buttonText, 
  onClick 
}: ActionCardProps) {
  // Mapeo de iconos a componentes de Lucide
  const getIcon = (): ReactNode => {
    const iconProps = { className: "h-8 w-8 text-white" };
    
    switch (icon) {
      case 'user-plus':
        return <UserPlus {...iconProps} />;
      case 'hand-holding-usd':
        return <CircleDollarSign {...iconProps} />;
      case 'money-bill-wave':
        return <Wallet {...iconProps} />;
      default:
        return <CircleDollarSign {...iconProps} />;
    }
  };

  // Mapeo de color a clases Tailwind
  const getBgColor = (): string => {
    switch (icon) {
      case 'user-plus':
        return 'bg-blue-600 dark:bg-blue-500';
      case 'hand-holding-usd':
        return 'bg-emerald-600 dark:bg-emerald-500';
      case 'money-bill-wave':
        return 'bg-indigo-600 dark:bg-indigo-500';
      default:
        return 'bg-primary';
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow border-2">
      <CardContent className="p-5 text-center">
        <div className={`rounded-full ${getBgColor()} p-4 mx-auto mb-4 w-16 h-16 flex items-center justify-center`}>
          {getIcon()}
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <Button 
          className="w-full"
          onClick={onClick}
        >
          {buttonText}
        </Button>
      </CardContent>
    </Card>
  );
}
