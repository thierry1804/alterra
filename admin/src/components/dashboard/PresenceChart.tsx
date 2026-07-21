import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import type { DashboardSummary } from "../../lib/dashboard";

interface PresenceChartProps {
  data: DashboardSummary["presenceLast7Days"];
}

export default function PresenceChart({ data }: PresenceChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Présence — 7 derniers jours</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#71717a" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#71717a" />
              <Tooltip
                formatter={(value) => [`${value ?? 0} MOC`, "Présents"]}
                labelFormatter={(label) => String(label)}
              />
              <Bar dataKey="workersPresent" fill="#52525b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
