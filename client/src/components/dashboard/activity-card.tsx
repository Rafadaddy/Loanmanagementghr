import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

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
    <Card className="h-full border-2">
      <CardHeader className="p-4 border-b">
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <ul className="divide-y">
          {items.map(item => (
            <li key={item.id} className="py-3">
              {item.image ? (
                // Con imagen (para lista de clientes)
                <div className="flex items-center">
                  <div className="flex-shrink-0 mr-3">{item.image}</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                  </div>
                </div>
              ) : (
                // Sin imagen (para pagos y préstamos)
                <div className="flex justify-between">
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                  </div>
                  <div className="text-right">
                    {item.amount && (
                      <p className={cn(
                        "text-sm font-semibold",
                        item.status === "pago" ? "text-emerald-600 dark:text-emerald-400" : ""
                      )}>
                        {item.status === "pago" && "+"}{item.amount}
                      </p>
                    )}
                    {item.status && item.statusClass && (
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-full",
                        item.statusClass
                      )}>
                        {item.status}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
          {items.length === 0 && (
            <li className="py-3 text-center text-muted-foreground text-sm">
              No hay datos recientes
            </li>
          )}
        </ul>
        <div className="mt-3 text-center">
          <Link href={viewAllLink}>
            <div className="text-sm text-primary hover:underline cursor-pointer">{viewAllText}</div>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
