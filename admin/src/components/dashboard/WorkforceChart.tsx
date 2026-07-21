import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import type { DashboardSummary } from "../../lib/dashboard";

interface WorkforceChartProps {
  data: DashboardSummary["workforceTrend"];
}

export default function WorkforceChart({ data }: WorkforceChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Évolution effectifs — 8 semaines</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
              <XAxis dataKey="weekLabel" tick={{ fontSize: 12 }} stroke="#71717a" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#71717a" />
              <Tooltip
                formatter={(value) => [`${value ?? 0} MOC`, "Actifs"]}
                labelFormatter={(label) => `Semaine ${label}`}
              />
              <Line
                type="monotone"
                dataKey="activeWorkers"
                stroke="#3f3f46"
                strokeWidth={2}
                dot={{ r: 3, fill: "#3f3f46" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
