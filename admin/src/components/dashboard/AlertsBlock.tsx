import { Link } from "react-router-dom";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import type { DashboardAlert } from "../../lib/dashboard";

interface AlertsBlockProps {
  alerts: DashboardAlert[];
}

export default function AlertsBlock({ alerts }: AlertsBlockProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Alertes</CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <p className="text-sm text-zinc-500">Aucune alerte active.</p>
        ) : (
          <ul className="space-y-3">
            {alerts.map((alert) => {
              const Icon = alert.severity === "error" ? AlertCircle : AlertTriangle;
              const content = (
                <div
                  className={`flex items-start gap-3 rounded-md border px-3 py-2 text-sm ${
                    alert.severity === "error"
                      ? "border-red-200 bg-red-50 text-red-800"
                      : "border-amber-200 bg-amber-50 text-amber-900"
                  }`}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{alert.message}</span>
                </div>
              );

              return (
                <li key={alert.id}>
                  {alert.link ? (
                    <Link to={alert.link} className="block hover:opacity-90">
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
