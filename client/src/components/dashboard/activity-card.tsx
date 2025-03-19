import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";

interface ActivityItem {
  id: number;
  title: string;
  subtitle: string;
  amount?: string | number;
  status?: string;
  statusClass?: string;
  image?: React.ReactNode;
  link?: string;
}

interface ActivityCardProps {
  title: string;
  items: ActivityItem[];
  viewAllLink: string;
  viewAllText: string;
}

export default function ActivityCard({ title, items, viewAllLink, viewAllText }: ActivityCardProps) {
  return (
    <Card className="h-full">
      <CardHeader className="p-4 border-b border-gray-200">
        <CardTitle className="text-lg font-semibold text-gray-800">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <ul className="divide-y divide-gray-200">
          {items.map(item => (
            <li key={item.id} className="py-3">
              {item.image ? (
                // Con imagen (para lista de clientes)
                <div className="flex items-center">
                  <div className="flex-shrink-0 mr-3">{item.image}</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{item.title}</p>
                    <p className="text-xs text-gray-500">{item.subtitle}</p>
                  </div>
                </div>
              ) : (
                // Sin imagen (para pagos y préstamos)
                <div className="flex justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{item.title}</p>
                    <p className="text-xs text-gray-500">{item.subtitle}</p>
                  </div>
                  <div className="text-right">
                    {item.amount && (
                      <p className={`text-sm font-semibold ${item.status === "pago" ? "text-green-600" : "text-gray-800"}`}>
                        {item.status === "pago" && "+"}{item.amount}
                      </p>
                    )}
                    {item.status && item.statusClass && (
                      <span className={`text-xs ${item.statusClass} px-2 py-1 rounded-full`}>
                        {item.status}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
          {items.length === 0 && (
            <li className="py-3 text-center text-gray-500 text-sm">
              No hay datos recientes
            </li>
          )}
        </ul>
        <div className="mt-3 text-center">
          <Link href={viewAllLink}>
            <a className="text-sm text-primary hover:text-blue-600">{viewAllText}</a>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
