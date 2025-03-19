import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
}

export default function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center">
          <div className={`rounded-full ${color} p-3 mr-4`}>
            <i className={`fas fa-${icon} text-${icon === 'dollar-sign' ? 'green' : icon === 'calendar-day' ? 'indigo' : icon === 'exclamation-triangle' ? 'red' : 'primary'}-600`}></i>
          </div>
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
