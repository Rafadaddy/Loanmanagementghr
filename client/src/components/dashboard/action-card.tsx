import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5 text-center">
        <div className={`rounded-full ${color} p-4 mx-auto mb-4 w-16 h-16 flex items-center justify-center`}>
          <i className={`fas fa-${icon} text-2xl text-${icon === 'hand-holding-usd' ? 'green' : icon === 'money-bill-wave' ? 'indigo' : 'primary'}-600`}></i>
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-4">{description}</p>
        <Button 
          className="w-full bg-primary hover:bg-blue-600"
          onClick={onClick}
        >
          {buttonText}
        </Button>
      </CardContent>
    </Card>
  );
}
